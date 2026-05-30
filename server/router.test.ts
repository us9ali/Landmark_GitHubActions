import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

let memoryStore: { id: number; name: string; email: string; contact: string; address: string; country: string; createdAt: Date }[] = [];
let nextId = 1;

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof db>();
  return {
    ...original,
    isDatabaseAvailable: vi.fn(async () => true),
    getContacts: vi.fn(async () => memoryStore),
    createContact: vi.fn(async (data) => {
      const entry = { id: nextId++, ...data, createdAt: new Date() };
      memoryStore.push(entry);
      return entry;
    }),
    deleteContact: vi.fn(async (id: number) => {
      const idx = memoryStore.findIndex((c) => c.id === id);
      if (idx === -1) return false;
      memoryStore.splice(idx, 1);
      return true;
    }),
  };
});

beforeEach(() => {
  memoryStore = [];
  nextId = 1;
});

function createMockContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("system router — health endpoint", () => {
  it("returns ok with current timestamp", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.system.health({ timestamp: Date.now() });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok with timestamp 0", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.system.health({ timestamp: 0 });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok with a large timestamp", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.system.health({ timestamp: 9999999999999 });
    expect(result).toEqual({ ok: true });
  });

  it("rejects negative timestamp", async () => {
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.system.health({ timestamp: -1 })).rejects.toThrow();
  });

  it("multiple sequential health checks all succeed", async () => {
    const caller = appRouter.createCaller(createMockContext());
    for (let i = 0; i < 5; i++) {
      const result = await caller.system.health({ timestamp: Date.now() + i });
      expect(result.ok).toBe(true);
    }
  });
});

describe("contacts router — input validation via tRPC", () => {
  it("create rejects missing name", async () => {
    const caller = appRouter.createCaller(createMockContext());
    await expect(
      caller.contacts.create({
        name: "",
        email: "a@b.com",
        contact: "123",
        address: "addr",
        country: "US",
      })
    ).rejects.toThrow();
  });

  it("create rejects invalid email", async () => {
    const caller = appRouter.createCaller(createMockContext());
    await expect(
      caller.contacts.create({
        name: "Test",
        email: "not-an-email",
        contact: "123",
        address: "addr",
        country: "US",
      })
    ).rejects.toThrow();
  });

  it("create succeeds with valid input", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.contacts.create({
      name: "Router Test",
      email: "router@test.com",
      contact: "555-0000",
      address: "100 Router Ln",
      country: "USA",
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Router Test");
  });

  it("list returns an array", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const list = await caller.contacts.list();
    expect(Array.isArray(list)).toBe(true);
  });

  it("create then list includes the new contact", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const created = await caller.contacts.create({
      name: "Findable",
      email: "find@me.com",
      contact: "111",
      address: "Find St",
      country: "CA",
    });
    const list = await caller.contacts.list();
    expect(list.some((c) => c.id === created!.id)).toBe(true);
  });

  it("delete removes a contact via router", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const created = await caller.contacts.create({
      name: "Deletable",
      email: "del@me.com",
      contact: "222",
      address: "Del St",
      country: "UK",
    });
    const result = await caller.contacts.delete({ id: created!.id });
    expect(result).toBe(true);
  });

  it("delete returns false for non-existent id", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.contacts.delete({ id: -1 });
    expect(result).toBe(false);
  });

  it("create rejects country longer than 100 chars", async () => {
    const caller = appRouter.createCaller(createMockContext());
    await expect(
      caller.contacts.create({
        name: "Test",
        email: "t@t.com",
        contact: "123",
        address: "addr",
        country: "A".repeat(101),
      })
    ).rejects.toThrow();
  });
});
