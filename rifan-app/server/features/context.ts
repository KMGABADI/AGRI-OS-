import type { Request, Response, NextFunction, Express } from "express";
import type { Store } from "../database";
import type { Entity, Row, Session } from "../../src/model";
export type ActorRequest = Request & { actor: Session };
export function reject(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
export const route =
  (fn: (req: ActorRequest, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => fn(req as ActorRequest, res))
      .catch(next);
  };
export interface FeatureContext {
  app: Express;
  s: Store;
  allowed: (a: Session, e: Entity, r: Row) => boolean;
  requireWrite: (a: Session, e: Entity | "settings" | "users") => void;
  farmerWhere: (a: Session, filters?: any) => { where: string; args: any[] };
}
export const admin = (actor: Session) =>
  ["Super Admin", "Admin"].includes(actor.role);
export const manager = (actor: Session) =>
  ["Super Admin", "Admin", "Manager"].includes(actor.role);
export function publicRecord(row: any) {
  const copy = { ...row };
  for (const key of [
    "bvn",
    "nin",
    "accountNumber",
    "hash",
    "salt",
    "secret",
    "access_token",
    "refresh_token",
  ])
    delete copy[key];
  return copy;
}
