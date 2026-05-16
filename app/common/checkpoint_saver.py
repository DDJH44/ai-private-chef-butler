"""MySQL 版 LangGraph 检查点保存器 —— 替代 langgraph-checkpoint-sqlite"""
import json
import random
import threading
from contextlib import contextmanager
from typing import Any, Iterator, Sequence, cast

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    WRITES_IDX_MAP,
    BaseCheckpointSaver,
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    SerializerProtocol,
    get_checkpoint_id,
    get_checkpoint_metadata,
)
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from app.common.database import SessionLocal
from app.models.db import CheckpointRow, WriteRow


class MySQLSaver(BaseCheckpointSaver[str]):
    """将 LangGraph 检查点存入 MySQL 的自定义保存器。

    接口与 SqliteSaver 完全一致，支持：
    - 按 thread_id / checkpoint_id 检索
    - INSERT OR REPLACE → MySQL ON DUPLICATE KEY UPDATE
    - 线程安全（内部锁）
    """

    def __init__(self, *, serde: SerializerProtocol | None = None) -> None:
        super().__init__(serde=serde)
        self.jsonplus_serde = JsonPlusSerializer()
        self.lock = threading.Lock()

    @contextmanager
    def cursor(self, transaction: bool = True) -> Iterator[Any]:
        """获取 SQLAlchemy 会话，等价于 SqliteSaver.cursor()"""
        with self.lock:
            session = SessionLocal()
            try:
                yield session
                if transaction:
                    session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()

    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        thread_id = str(config["configurable"]["thread_id"])

        with self.cursor(transaction=False) as session:
            checkpoint_id = get_checkpoint_id(config)
            if checkpoint_id:
                row = (
                    session.query(CheckpointRow)
                    .filter(
                        CheckpointRow.thread_id == thread_id,
                        CheckpointRow.checkpoint_ns == checkpoint_ns,
                        CheckpointRow.checkpoint_id == checkpoint_id,
                    )
                    .first()
                )
            else:
                row = (
                    session.query(CheckpointRow)
                    .filter(
                        CheckpointRow.thread_id == thread_id,
                        CheckpointRow.checkpoint_ns == checkpoint_ns,
                    )
                    .order_by(CheckpointRow.checkpoint_id.desc())
                    .first()
                )

            if not row:
                return None

            if not checkpoint_id:
                config = {
                    "configurable": {
                        "thread_id": row.thread_id,
                        "checkpoint_ns": checkpoint_ns,
                        "checkpoint_id": row.checkpoint_id,
                    }
                }

            writes = (
                session.query(WriteRow)
                .filter(
                    WriteRow.thread_id == thread_id,
                    WriteRow.checkpoint_ns == checkpoint_ns,
                    WriteRow.checkpoint_id == row.checkpoint_id,
                )
                .order_by(WriteRow.task_id, WriteRow.idx)
                .all()
            )

            return CheckpointTuple(
                config,
                self.serde.loads_typed((row.type, row.checkpoint)),
                cast(
                    CheckpointMetadata,
                    json.loads(row.meta) if row.meta is not None else {},
                ),
                (
                    {
                        "configurable": {
                            "thread_id": row.thread_id,
                            "checkpoint_ns": checkpoint_ns,
                            "checkpoint_id": row.parent_checkpoint_id,
                        }
                    }
                    if row.parent_checkpoint_id
                    else None
                ),
                [
                    (w.task_id, w.channel, self.serde.loads_typed((w.type, w.value)))
                    for w in writes
                ],
            )

    def list(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> Iterator[CheckpointTuple]:
        thread_id = config["configurable"]["thread_id"] if config else None
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "") if config else ""

        with self.cursor(transaction=False) as session:
            query = session.query(CheckpointRow)
            if thread_id:
                query = query.filter(CheckpointRow.thread_id == thread_id)
            if checkpoint_ns:
                query = query.filter(CheckpointRow.checkpoint_ns == checkpoint_ns)
            if before and "checkpoint_id" in before.get("configurable", {}):
                query = query.filter(
                    CheckpointRow.checkpoint_id < before["configurable"]["checkpoint_id"]
                )
            query = query.order_by(CheckpointRow.checkpoint_id.desc())
            if limit:
                query = query.limit(limit)

            for row in query.all():
                writes = (
                    session.query(WriteRow)
                    .filter(
                        WriteRow.thread_id == row.thread_id,
                        WriteRow.checkpoint_ns == row.checkpoint_ns,
                        WriteRow.checkpoint_id == row.checkpoint_id,
                    )
                    .order_by(WriteRow.task_id, WriteRow.idx)
                    .all()
                )
                yield CheckpointTuple(
                    {
                        "configurable": {
                            "thread_id": row.thread_id,
                            "checkpoint_ns": row.checkpoint_ns,
                            "checkpoint_id": row.checkpoint_id,
                        }
                    },
                    self.serde.loads_typed((row.type, row.checkpoint)),
                    cast(
                        CheckpointMetadata,
                        json.loads(row.meta) if row.meta is not None else {},
                    ),
                    (
                        {
                            "configurable": {
                                "thread_id": row.thread_id,
                                "checkpoint_ns": row.checkpoint_ns,
                                "checkpoint_id": row.parent_checkpoint_id,
                            }
                        }
                        if row.parent_checkpoint_id
                        else None
                    ),
                    [
                        (w.task_id, w.channel, self.serde.loads_typed((w.type, w.value)))
                        for w in writes
                    ],
                )

    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        thread_id = str(config["configurable"]["thread_id"])
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        type_, serialized_checkpoint = self.serde.dumps_typed(checkpoint)
        serialized_metadata = json.dumps(
            get_checkpoint_metadata(config, metadata), ensure_ascii=False
        ).encode("utf-8", "ignore")

        with self.cursor() as session:
            existing = session.query(CheckpointRow).filter(
                CheckpointRow.thread_id == thread_id,
                CheckpointRow.checkpoint_ns == checkpoint_ns,
                CheckpointRow.checkpoint_id == checkpoint["id"],
            ).first()

            if existing:
                existing.parent_checkpoint_id = config["configurable"].get("checkpoint_id")
                existing.type = type_
                existing.checkpoint = serialized_checkpoint
                existing.meta = serialized_metadata
            else:
                row = CheckpointRow(
                    thread_id=thread_id,
                    checkpoint_ns=checkpoint_ns,
                    checkpoint_id=checkpoint["id"],
                    parent_checkpoint_id=config["configurable"].get("checkpoint_id"),
                    type=type_,
                    checkpoint=serialized_checkpoint,
                    meta=serialized_metadata,
                )
                session.add(row)

        return {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": checkpoint_ns,
                "checkpoint_id": checkpoint["id"],
            }
        }

    def put_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        thread_id = str(config["configurable"]["thread_id"])
        checkpoint_ns = str(config["configurable"].get("checkpoint_ns", ""))
        checkpoint_id_val = str(config["configurable"]["checkpoint_id"])

        with self.cursor() as session:
            for idx, (channel, value) in enumerate(writes):
                type_, serialized_value = self.serde.dumps_typed(value)
                write_idx = WRITES_IDX_MAP.get(channel, idx)

                existing = session.query(WriteRow).filter(
                    WriteRow.thread_id == thread_id,
                    WriteRow.checkpoint_ns == checkpoint_ns,
                    WriteRow.checkpoint_id == checkpoint_id_val,
                    WriteRow.task_id == task_id,
                    WriteRow.idx == write_idx,
                ).first()

                if existing:
                    existing.channel = channel
                    existing.type = type_
                    existing.value = serialized_value
                else:
                    row = WriteRow(
                        thread_id=thread_id,
                        checkpoint_ns=checkpoint_ns,
                        checkpoint_id=checkpoint_id_val,
                        task_id=task_id,
                        idx=write_idx,
                        channel=channel,
                        type=type_,
                        value=serialized_value,
                    )
                    session.add(row)

    def delete_thread(self, thread_id: str) -> None:
        with self.cursor() as session:
            session.query(CheckpointRow).filter(
                CheckpointRow.thread_id == str(thread_id)
            ).delete(synchronize_session=False)
            session.query(WriteRow).filter(
                WriteRow.thread_id == str(thread_id)
            ).delete(synchronize_session=False)

    def get_next_version(self, current: str | None, channel: None) -> str:
        if current is None:
            current_v = 0
        elif isinstance(current, int):
            current_v = current
        else:
            current_v = int(current.split(".")[0])
        next_v = current_v + 1
        next_h = random.random()
        return f"{next_v:032}.{next_h:016}"
