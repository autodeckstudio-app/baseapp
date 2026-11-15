import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export type Review = { rating: number; comment: string };

export async function getReview(bookingId: string, jobId?:string): Promise<Review | null> {
  const {data}=await httpsCallable<{bookingId?:string;jobId?:string},{review:Review|null}>(functions,'getMyVisitReview')(jobId?{jobId}:{bookingId});
  return data.review;
}
export async function submitReview(bookingId: string, rating: number, comment: string, jobId?:string): Promise<void> {
  await httpsCallable(functions, 'submitReview')(jobId?{jobId,rating,comment}:{bookingId,rating,comment});
}

export type ServiceReviews = {
  average: number | null;
  count: number;
  recent: { rating: number; comment: string; date: string }[];
};

export async function getServiceReviews(serviceId: string): Promise<ServiceReviews> {
  const res = await httpsCallable<{ serviceId: string }, ServiceReviews>(functions, "getServiceReviews")({ serviceId });
  return res.data;
}
