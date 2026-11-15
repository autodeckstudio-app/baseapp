import{httpsCallable}from'firebase/functions';import{functions}from'./firebase';
export type VisitFeedbackTarget={jobId:string;bookingId?:never}|{bookingId:string;jobId?:never};
export type VisitFeedback={rating:number;comment:string;updatedAt:string|null};
export async function getVisitFeedback(target:VisitFeedbackTarget):Promise<VisitFeedback|null>{return (await httpsCallable<VisitFeedbackTarget,{review:VisitFeedback|null}>(functions,'getVisitFeedback')(target)).data.review;}
