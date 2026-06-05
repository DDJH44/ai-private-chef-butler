import { authRequest } from "./api";
import { BodyMetric } from "@/types/preference";

export async function fetchBodyMetrics(days: number = 30): Promise<BodyMetric[]> {
    return authRequest<BodyMetric[]>(`/api/v1/body-metrics?days=${days}`);
}

export async function createBodyMetric(data: {
    date: string;
    weight?: number;
    body_fat?: number;
    muscle_mass?: number;
    waist?: number;
    notes?: string;
}): Promise<BodyMetric> {
    return authRequest<BodyMetric>("/api/v1/body-metrics", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deleteBodyMetric(id: string): Promise<void> {
    return authRequest<void>(`/api/v1/body-metrics/${id}`, { method: "DELETE" });
}
