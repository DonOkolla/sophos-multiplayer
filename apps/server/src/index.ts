import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { randomInt, randomUUID } from 'node:crypto';
import type { Player, RoomState, PublicQuestion } from '@sophos/shared';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
app.use(cors({ origin: true }));

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const frontendPath = path.resolve(currentDir, '../../web/dist');

app.use(express.static(frontendPath));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sophos-server' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] }
});
const PORT=Number(process.env.PORT||3001);
type Q={id:string;category:string;prompt:string;options:string[];correctIndex:number;explanation:string;round:number;doubleKnowledge?:boolean};
const questions:Q[]=[
{ id:'q1',category:'Science',prompt:'Which planet has the most confirmed moons (according to recent observations)?',options:['Jupiter','Saturn','Neptune','Uranus'],correctIndex:1,explanation:'Saturn currently leads in confirmed natural satellites; counts can change as new moons are verified.',round:1},
{ id:'q2',category:'Geography',prompt:'Which river flows through the city of Cairo?',options:['Tigris','Niger','Nile','Congo'],correctIndex:2,explanation:'Cairo sits on the Nile, one of the world’s longest river systems.',round:1},
{ id:'q3',category:'History',prompt:'The ancient city of Petra is located in which modern country?',options:['Jordan','Egypt','Greece','Lebanon'],correctIndex:0,explanation:'Petra, famous for its rock-cut architecture, is in southern Jordan.',round:1},
{ id:'q4',category:'Logic',prompt:'A clock shows 3:15. What is the smaller angle between its hands?',options:['0°','7.5°','15°','22.5°'],correctIndex:1,explanation:'At 3:15 the minute hand is at 90°; the hour hand is at 97.5°, so the gap is 7.5°.',round:1},
{ id:'q5',category:'World Cultures',prompt:'Which writing system was used for many inscriptions in ancient Egypt?',options:['Cuneiform','Hieroglyphs','Linear B','Runes'],correctIndex:1,explanation:'Egyptian hieroglyphs combined logographic, syllabic, and alphabetic signs.',round:1},
{ id:'q6',category:'Nature',prompt:'What is the only group of mammals capable of sustained true flight?',options:['Flying squirrels','Bats','Sugar gliders','Colugos'],correctIndex:1,explanation:'Bats are the only mammals capable of powered, sustained flight.',round:2},
{ id:'q7',category:'Technology',prompt:'What does the “S” in HTTPS stand for?',options:['Secure','System','Server','Synchronized'],correctIndex:0,explanation:'HTTPS uses HTTP over a secure connection, typically protected by TLS.',round:2},
{ id:'q8',category:'African Knowledge',prompt:'Which ancient African kingdom was famous for the rock-hewn churches of Lalibela?',options:['Kingdom of Kongo','Aksumite Empire','Ethiopian Zagwe dynasty','Mali Empire'],correctIndex:2,explanation:'The churches of Lalibela are associated with Ethiopia’s Zagwe dynasty, especially King Lalibela.',round:2},
{ id:'q9',category:'Science',prompt:'Which particle carries a negative electric charge?',options:['Proton','Neutron','Electron','Photon'],correctIndex:2,explanation:'Electrons carry a negative elementary charge; protons are positive and neutrons neutral.',round:2},
{ id:'q10',category:'Music',prompt:'How many keys are there on a standard modern piano?',options:['76','80','88','92'],correctIndex:2,explanation:'A standard full-size piano has 88 keys: 52 white and 36 black.',round:2},
{ id:'q11',category:'Geography',prompt:'Which country has the greatest number of time zones when its overseas territories are included?',options:['Russia','United States','France','China'],correctIndex:2,explanation:'France spans the most time zones when its overseas territories are counted.',round:3,doubleKnowledge:true},
{ id:'q12',category:'Literature',prompt:'Who wrote the philosophical work “The Republic”?',options:['Aristotle','Plato','Socrates','Herodotus'],correctIndex:1,explanation:'Plato wrote The Republic, a dialogue exploring justice and the ideal city-state.',round:3},
{ id:'q13',category:'Space',prompt:'Which spacecraft first carried humans to the Moon’s surface?',options:['Apollo 8','Apollo 10','Apollo 11','Gemini 7'],correctIndex:2,explanation:'Apollo 11 landed Neil Armstrong and Buzz Aldrin on the Moon in July 1969.',round:3},
{ id:'q14',category:'African History',prompt:'Timbuktu became a major centre of learning under which West African empire?',options:['Mali Empire','Great Zimbabwe','Benin Empire','Songhai only'],correctIndex:0,explanation:'Timbuktu flourished as a scholarly and trading centre under the Mali Empire and later Songhai.',round:3},
{ id:'q15',category:'Logic',prompt:'If all Zorbs are Mips, and no Mips are Tars, can any Zorb be a Tar?',options:['Yes, always','Yes, sometimes','No','Cannot be determined'],correctIndex:2,explanation:'Zorbs are a subset of Mips, and Mips cannot be Tars. Therefore, no Zorb can be a Tar.',round:3}
];
type Room={code:string;hostId:string;phase:RoomState['phase'];players:Map<string,Player>;socketByPlayer:Map<string,string>;round:number;questionIndex:number;question?:Q;questionStartedAt:number;questionEndsAt:number;timer?:NodeJS.Timeout;answers:Map<string,{index:number|null;at:number|null}>;scoresBefore:number;reveal?:RoomState['reveal'];winnerIds?:string[];usedQuestions:Set<string>};
const rooms=new Map<string,Room>(); const sessions=new Map<string,{code:string;playerId:string}>();
const cleanName=(v:unknown)=>String(v||'').trim().replace(/[<>]/g,'').slice(0,18)||'Scholar';
function code(){let s='';const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';do{s=Array.from({length:5},()=>chars[randomInt(chars.length)]).join('')}while(rooms.has(s));return s;}
function publicState(r:Room):RoomState {const players=[...r.players.values()].map(p=>({...p,answer:undefined,answeredAt:undefined}));const q=r.question?{id:r.question.id,category:r.question.category,prompt:r.question.prompt,options:r.question.options,round:r.question.round,questionNumber:r.questionIndex+1,totalQuestions:questions.length,endsAt:r.questionEndsAt,doubleKnowledge:!!r.question.doubleKnowledge}:undefined;return {code:r.code,phase:r.phase,hostId:r.hostId,players,round:r.round,questionIndex:r.questionIndex,question:q,reveal:r.reveal,winnerIds:r.winnerIds};}
function emit(r:Room){io.to(r.code).emit('state:update',publicState(r));}
function scoreOf(p:Player,q:Q,at:number){const elapsed=Math.max(0,Math.min(20_000,at));const remaining=Math.max(0,20_000-elapsed);const base=1000+Math.floor(300*remaining/20_000);return Math.min(1950,Math.floor(base*(p.usedGolden&&q.round===3?1.5:1)))+(q.doubleKnowledge?200:0);}
function nextQuestion(r:Room){if(r.timer)clearTimeout(r.timer);if(r.questionIndex>=questions.length){finish(r);return;}r.question=questions[r.questionIndex];r.round=r.question.round;r.phase='question';r.answers.clear();r.reveal=undefined;r.questionStartedAt=Date.now();r.questionEndsAt=Date.now()+20_000;r.players.forEach(p=>{p.answer=undefined;p.answeredAt=undefined;});emit(r);r.timer=setTimeout(()=>reveal(r),20_000);}
function reveal(r:Room){if(r.phase!=='question'||!r.question)return;if(r.timer)clearTimeout(r.timer);let correct=0;for(const p of r.players.values()){const a=r.answers.get(p.id);if(a&&a.index===r.question.correctIndex){correct++;p.correct++;const elapsed=Math.max(0,(a.at||Date.now())-r.questionStartedAt);p.score+=scoreOf(p,r.question,elapsed);}}r.phase='reveal';r.reveal={correctIndex:r.question.correctIndex,explanation:r.question.explanation,answerStats:{correct,total:r.players.size},lastQuestion:r.questionIndex===questions.length-1};emit(r);r.timer=setTimeout(()=>{r.questionIndex++;if(r.questionIndex>=questions.length)finish(r);else nextQuestion(r);},5000);}
function finish(r:Room){if(r.timer)clearTimeout(r.timer);r.phase='results';const sorted=[...r.players.values()].sort((a,b)=>b.score-a.score||b.correct-a.correct);if(sorted.length){const top=sorted[0];r.winnerIds=sorted.filter(p=>p.score===top.score&&p.correct===top.correct).map(p=>p.id);}emit(r);}
function leaveSocket(socket:Socket){const sess=sessions.get(socket.id);if(!sess)return;sessions.delete(socket.id);const r=rooms.get(sess.code);if(!r)return;const p=r.players.get(sess.playerId);if(p){p.connected=false;const sid=r.socketByPlayer.get(p.id);if(sid)r.socketByPlayer.delete(p.id);if(r.hostId===p.id){const next=[...r.players.values()].find(x=>x.connected&&x.id!==p.id);if(next)r.hostId=next.id;} }emit(r);}
io.on('connection',(socket)=>{
 socket.on('room:create',(payload:{name?:string},ack?:Function)=>{const c=code(),id=randomUUID();const p:Player={id,name:cleanName(payload?.name),score:0,connected:true,ready:true,isHost:true,correct:0,usedOracle:false,usedGolden:false,usedChronos:false};const r:Room={code:c,hostId:id,phase:'lobby',players:new Map([[id,p]]),socketByPlayer:new Map([[id,socket.id]]),round:0,questionIndex:0,questionStartedAt:0,questionEndsAt:0,answers:new Map(),scoresBefore:0,usedQuestions:new Set()};rooms.set(c,r);sessions.set(socket.id,{code:c,playerId:id});socket.join(c);ack?.({ok:true,code:c,playerId:id});emit(r);});
 socket.on('room:join',(payload:{code?:string;name?:string},ack?:Function)=>{const c=String(payload?.code||'').toUpperCase().trim(),r=rooms.get(c);if(!r){ack?.({ok:false,message:'That room code was not found.'});return;}if(r.phase!=='lobby'){ack?.({ok:false,message:'This match has already started.'});return;}if(r.players.size>=8){ack?.({ok:false,message:'This room is full (8 players maximum).'});return;}const id=randomUUID(),p:Player={id,name:cleanName(payload?.name),score:0,connected:true,ready:true,isHost:false,correct:0,usedOracle:false,usedGolden:false,usedChronos:false};r.players.set(id,p);r.socketByPlayer.set(id,socket.id);sessions.set(socket.id,{code:c,playerId:id});socket.join(c);ack?.({ok:true,code:c,playerId:id});emit(r);});
 socket.on('room:rematch',(_payload:unknown,ack?:Function)=>{const s=sessions.get(socket.id),r=s&&rooms.get(s.code),p=s&&r?.players.get(s.playerId);if(!r||!p){ack?.({ok:false,message:'Your room session could not be found.'});return;}if(r.phase!=='results'){ack?.({ok:false,message:'A rematch is available after the final results.'});return;}if(r.players.size<2){ack?.({ok:false,message:'At least two players are needed for a rematch.'});return;}if(r.timer)clearTimeout(r.timer);r.phase='lobby';r.round=0;r.questionIndex=0;r.question=undefined;r.reveal=undefined;r.winnerIds=undefined;r.answers.clear();r.usedQuestions.clear();r.players.forEach(player=>{player.score=0;player.correct=0;player.usedOracle=false;player.usedGolden=false;player.usedChronos=false;player.answer=undefined;player.answeredAt=undefined;});ack?.({ok:true});emit(r);});
 socket.on('room:start',(_payload:unknown,ack?:Function)=>{const s=sessions.get(socket.id),r=s&&rooms.get(s.code);if(!r||r.hostId!==s?.playerId){ack?.({ok:false,message:'Only the host can start the match.'});return;}if(r.players.size<2){ack?.({ok:false,message:'Invite at least one more player to begin.'});return;}r.players.forEach(p=>{p.score=0;p.correct=0;p.usedOracle=false;p.usedGolden=false;p.usedChronos=false;});r.questionIndex=0;ack?.({ok:true});nextQuestion(r);});
 socket.on('answer:submit',(payload:{index:number},ack?:Function)=>{const s=sessions.get(socket.id),r=s&&rooms.get(s.code),p=s&&r?.players.get(s.playerId);if(!r||!p||r.phase!=='question'||!r.question){ack?.({ok:false,message:'There is no active question.'});return;}if(r.answers.has(p.id)){ack?.({ok:false,message:'Your answer is already locked.'});return;}if(Date.now()>r.questionEndsAt){ack?.({ok:false,message:'Time is up.'});return;}if(!Number.isInteger(payload?.index)||payload.index<0||payload.index>3){ack?.({ok:false,message:'Invalid answer.'});return;}r.answers.set(p.id,{index:payload.index,at:Date.now()});p.answer=payload.index;p.answeredAt=Date.now();ack?.({ok:true});io.to(r.code).emit('answer:progress',{answered:r.answers.size,total:r.players.size});if(r.answers.size===r.players.size)reveal(r);});
 socket.on('powerup:activate',(payload:{type:'oracle'|'golden'|'chronos'},ack?:Function)=>{const s=sessions.get(socket.id),r=s&&rooms.get(s.code),p=s&&r?.players.get(s.playerId);if(!r||!p||r.phase!=='question'||!r.question){ack?.({ok:false,message:'Power-ups can only be used during a question.'});return;}if(payload.type==='oracle'){if(r.round!==2||p.usedOracle){ack?.({ok:false,message:'Oracle’s Insight is unavailable.'});return;}p.usedOracle=true;const wrong=r.question.options.map((_,i)=>i).filter(i=>i!==r.question!.correctIndex);const remove=wrong.sort(()=>Math.random()-.5).slice(0,2);ack?.({ok:true,remove});return;}if(payload.type==='golden'){if(r.round!==3||p.usedGolden){ack?.({ok:false,message:'Golden Focus is unavailable.'});return;}p.usedGolden=true;ack?.({ok:true});return;}if(payload.type==='chronos'){if(r.round!==3||p.usedChronos){ack?.({ok:false,message:'Chronos is unavailable.'});return;}p.usedChronos=true;ack?.({ok:true,endsAt:r.questionEndsAt+5000});return;}ack?.({ok:false,message:'Unknown power-up.'});});
 socket.on('session:resume',(payload:{code:string;playerId:string},ack?:Function)=>{const r=rooms.get(String(payload?.code||'').toUpperCase()),p=r?.players.get(payload?.playerId);if(!r||!p){ack?.({ok:false,message:'Session could not be restored.'});return;}const old=r.socketByPlayer.get(p.id);if(old&&old!==socket.id){const oldSocket=io.sockets.sockets.get(old);oldSocket?.leave(r.code);sessions.delete(old);}p.connected=true;r.socketByPlayer.set(p.id,socket.id);sessions.set(socket.id,{code:r.code,playerId:p.id});socket.join(r.code);ack?.({ok:true,code:r.code,playerId:p.id,state:publicState(r)});emit(r);});
 socket.on('disconnect',()=>leaveSocket(socket));
});
httpServer.listen(PORT,()=>console.log(`SOPHOS server listening on ${PORT}`));
