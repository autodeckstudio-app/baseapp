import { expect, it } from "vitest";
import { transactionRead } from "../../lib/transaction-read.js";
it("normalizes only the exact closed transaction read to SDK ABORTED",async()=>{const original=Object.assign(new Error("3 INVALID_ARGUMENT: Transaction is invalid or closed."),{code:3,details:"Transaction is invalid or closed."});await expect(transactionRead(async()=>{throw original})).rejects.toMatchObject({code:10,cause:original});});
it("preserves unrelated malformed input and every business failure without retry",async()=>{for(const err of [{code:3,details:"Bad query"},{code:"failed-precondition",details:"Transaction is invalid or closed."},{code:10,details:"aborted"},new Error("other")]){let reads=0;try{await transactionRead(async()=>{reads++;throw err})}catch(e){expect(e).toBe(err)}expect(reads).toBe(1)}});
it("returns the exact successful snapshot",async()=>{const snap={exists:true};expect(await transactionRead(async()=>snap)).toBe(snap)});
