import { randomUUID } from "node:crypto";
import { HttpError } from "./httpError.js";

export function newId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function assertSafeId(id, label = "id") {
  if (!/^[a-zA-Z0-9_-]+$/.test(id || "")) {
    throw new HttpError(400, `Invalid ${label}`);
  }
}
