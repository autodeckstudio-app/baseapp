import {it,expect,vi} from "vitest";
const h=vi.hoisted(()=>({call:vi.fn()}));
vi.mock("firebase/functions",()=>({httpsCallable:()=>h.call}));vi.mock("./firebase",()=>({functions:{}}));
import {purchaseMembership,upgradeMembership} from "./membership-service";
it.each([purchaseMembership,upgradeMembership])("replays same request once after competing pending membership commit",async fn=>{
 h.call.mockReset();h.call.mockRejectedValueOnce({code:"functions/already-exists"}).mockResolvedValueOnce({data:{membershipId:"same",paymentId:"p",paymentUrl:"https://pay.example"}});
 expect(await fn("plan","razorpay_payment_link","key")).toMatchObject({membershipId:"same"});expect(h.call).toHaveBeenCalledTimes(2);expect(h.call.mock.calls[0]).toEqual(h.call.mock.calls[1]);
});
