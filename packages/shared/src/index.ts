export type Phase = 'lobby'|'question'|'reveal'|'results';
export type Player = { id:string; name:string; score:number; connected:boolean; ready:boolean; isHost:boolean; correct:number; usedOracle:boolean; usedGolden:boolean; usedChronos:boolean; answer?:number|null; answeredAt?:number|null };
export type PublicQuestion = { id:string; category:string; prompt:string; options:string[]; round:number; questionNumber:number; totalQuestions:number; endsAt:number; doubleKnowledge:boolean };
export type RoomState = { code:string; phase:Phase; hostId:string; players:Player[]; round:number; questionIndex:number; question?:PublicQuestion; reveal?:{correctIndex:number;explanation:string;answerStats:{correct:number;total:number};lastQuestion:boolean}; winnerIds?:string[]; message?:string };
export type ServerError = {message:string};
