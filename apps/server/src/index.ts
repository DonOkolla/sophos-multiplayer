import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { randomInt, randomUUID } from 'node:crypto';
import type { Player, RoomState } from '@sophos/shared';
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

const PORT = Number(process.env.PORT || 3001);

type Q = {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  round: number;
  doubleKnowledge?: boolean;
};

const QUESTIONS_PER_ROUND = 5;
const TOTAL_ROUNDS = 3;
const QUESTIONS_PER_MATCH = QUESTIONS_PER_ROUND * TOTAL_ROUNDS;
const QUESTION_TIME_MS = 20_000;
const REVEAL_TIME_MS = 5_000;

/*
 * SOPHOS QUESTION BANK
 * Each match receives 5 randomly selected questions per round.
 * Add new questions with unique IDs to expand the bank.
 */

const questions: Q[] = [
  // ROUND 1 — THE AWAKENING
  { id: 'r1-001', category: 'Science', prompt: 'Which planet has the most confirmed moons according to current observations?', options: ['Jupiter', 'Saturn', 'Neptune', 'Uranus'], correctIndex: 1, explanation: 'Saturn currently has the most confirmed moons; the count can change as new moons are verified.', round: 1 },
  { id: 'r1-002', category: 'Geography', prompt: 'Which river flows through Cairo?', options: ['Tigris', 'Niger', 'Nile', 'Congo'], correctIndex: 2, explanation: 'Cairo sits on the Nile River.', round: 1 },
  { id: 'r1-003', category: 'History', prompt: 'Petra, the ancient city famous for rock-cut architecture, is in which modern country?', options: ['Jordan', 'Egypt', 'Greece', 'Lebanon'], correctIndex: 0, explanation: 'Petra is located in southern Jordan.', round: 1 },
  { id: 'r1-004', category: 'Logic', prompt: 'A clock shows 3:15. What is the smaller angle between its hands?', options: ['0°', '7.5°', '15°', '22.5°'], correctIndex: 1, explanation: 'At 3:15, the minute hand is at 90° and the hour hand is at 97.5°, leaving 7.5°.', round: 1 },
  { id: 'r1-005', category: 'World Cultures', prompt: 'Which writing system was used in many inscriptions in ancient Egypt?', options: ['Cuneiform', 'Hieroglyphs', 'Linear B', 'Runes'], correctIndex: 1, explanation: 'Ancient Egyptian hieroglyphs used signs representing words and sounds.', round: 1 },
  { id: 'r1-006', category: 'Nature', prompt: 'Which group of mammals is capable of sustained powered flight?', options: ['Flying squirrels', 'Bats', 'Sugar gliders', 'Colugos'], correctIndex: 1, explanation: 'Bats are the only mammals capable of sustained powered flight.', round: 1 },
  { id: 'r1-007', category: 'Technology', prompt: 'What does the S in HTTPS stand for?', options: ['Secure', 'System', 'Server', 'Synchronized'], correctIndex: 0, explanation: 'HTTPS is HTTP protected by a secure transport connection, usually TLS.', round: 1 },
  { id: 'r1-008', category: 'African Knowledge', prompt: 'The rock-hewn churches of Lalibela are in which country?', options: ['Ethiopia', 'Ghana', 'Senegal', 'Tanzania'], correctIndex: 0, explanation: 'Lalibela is a historic town in Ethiopia, renowned for its rock-hewn churches.', round: 1 },
  { id: 'r1-009', category: 'Science', prompt: 'Which particle carries a negative electric charge?', options: ['Proton', 'Neutron', 'Electron', 'Photon'], correctIndex: 2, explanation: 'Electrons carry a negative elementary electric charge.', round: 1 },
  { id: 'r1-010', category: 'Music', prompt: 'How many keys are on a standard full-size modern piano?', options: ['76', '80', '88', '92'], correctIndex: 2, explanation: 'A standard full-size piano has 88 keys.', round: 1 },
  { id: 'r1-011', category: 'Geography', prompt: 'Which country is home to the city of Kyoto?', options: ['China', 'Japan', 'South Korea', 'Thailand'], correctIndex: 1, explanation: 'Kyoto is a historic city in Japan.', round: 1 },
  { id: 'r1-012', category: 'Literature', prompt: 'Who wrote the novel 1984?', options: ['Aldous Huxley', 'George Orwell', 'Ray Bradbury', 'H. G. Wells'], correctIndex: 1, explanation: 'George Orwell published the dystopian novel Nineteen Eighty-Four in 1949.', round: 1 },
  { id: 'r1-013', category: 'Space', prompt: 'Which star is closest to Earth?', options: ['Sirius', 'Proxima Centauri', 'The Sun', 'Alpha Centauri A'], correctIndex: 2, explanation: 'The Sun is the star closest to Earth.', round: 1 },
  { id: 'r1-014', category: 'Sports', prompt: 'How many players from one soccer team are normally on the field at the start of a match?', options: ['9', '10', '11', '12'], correctIndex: 2, explanation: 'A standard association football team starts with eleven players on the field.', round: 1 },
  { id: 'r1-015', category: 'Art', prompt: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Sandro Botticelli'], correctIndex: 1, explanation: 'The Mona Lisa was painted by Leonardo da Vinci.', round: 1 },
  { id: 'r1-016', category: 'Food', prompt: 'Which grain is traditionally used to make risotto?', options: ['Arborio rice', 'Couscous', 'Quinoa', 'Bulgur wheat'], correctIndex: 0, explanation: 'Risotto is commonly made with starchy short-grain rice such as Arborio.', round: 1 },
  { id: 'r1-017', category: 'Science', prompt: 'What is the chemical symbol for gold?', options: ['Ag', 'Gd', 'Au', 'Go'], correctIndex: 2, explanation: 'Gold’s chemical symbol is Au, from the Latin word aurum.', round: 1 },
  { id: 'r1-018', category: 'Geography', prompt: 'What is the capital city of Canada?', options: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa'], correctIndex: 3, explanation: 'Ottawa, in Ontario, is the capital of Canada.', round: 1 },
  { id: 'r1-019', category: 'Animals', prompt: 'What is the largest living species of cat?', options: ['Lion', 'Tiger', 'Jaguar', 'Leopard'], correctIndex: 1, explanation: 'The tiger is the largest living cat species.', round: 1 },
  { id: 'r1-020', category: 'Maths', prompt: 'What is 12 squared?', options: ['124', '132', '144', '164'], correctIndex: 2, explanation: '12 × 12 = 144.', round: 1 },

  // ROUND 2 — THE BLITZ BATTLE
  { id: 'r2-001', category: 'Geography', prompt: 'Which country has the greatest number of time zones when its overseas territories are included?', options: ['Russia', 'United States', 'France', 'China'], correctIndex: 2, explanation: 'France spans the most time zones when its overseas territories are included.', round: 2, doubleKnowledge: true },
  { id: 'r2-002', category: 'Literature', prompt: 'Who wrote the philosophical work The Republic?', options: ['Aristotle', 'Plato', 'Socrates', 'Herodotus'], correctIndex: 1, explanation: 'Plato wrote The Republic, a dialogue exploring justice and the ideal state.', round: 2 },
  { id: 'r2-003', category: 'Space', prompt: 'Which mission first landed humans on the Moon?', options: ['Apollo 8', 'Apollo 10', 'Apollo 11', 'Gemini 7'], correctIndex: 2, explanation: 'Apollo 11 landed Neil Armstrong and Buzz Aldrin on the Moon in July 1969.', round: 2 },
  { id: 'r2-004', category: 'African History', prompt: 'Timbuktu became a major centre of learning under which West African empire?', options: ['Mali Empire', 'Great Zimbabwe', 'Benin Empire', 'Kingdom of Kongo'], correctIndex: 0, explanation: 'Timbuktu flourished under the Mali Empire and later the Songhai Empire.', round: 2 },
  { id: 'r2-005', category: 'Logic', prompt: 'If all Zorbs are Mips and no Mips are Tars, can any Zorb be a Tar?', options: ['Yes, always', 'Yes, sometimes', 'No', 'Cannot be determined'], correctIndex: 2, explanation: 'Every Zorb is a Mip, and no Mip is a Tar, so no Zorb can be a Tar.', round: 2 },
  { id: 'r2-006', category: 'Science', prompt: 'What is the hardest naturally occurring mineral on the Mohs scale?', options: ['Quartz', 'Diamond', 'Topaz', 'Corundum'], correctIndex: 1, explanation: 'Diamond ranks 10 on the Mohs mineral hardness scale.', round: 2 },
  { id: 'r2-007', category: 'History', prompt: 'In which year did the Berlin Wall fall?', options: ['1987', '1989', '1991', '1993'], correctIndex: 1, explanation: 'The Berlin Wall opened in November 1989.', round: 2 },
  { id: 'r2-008', category: 'Technology', prompt: 'What does CPU stand for?', options: ['Central Processing Unit', 'Computer Power Utility', 'Core Program Upload', 'Central Program User'], correctIndex: 0, explanation: 'CPU stands for Central Processing Unit.', round: 2 },
  { id: 'r2-009', category: 'Nature', prompt: 'What is the process by which plants use sunlight to make sugars called?', options: ['Respiration', 'Fermentation', 'Photosynthesis', 'Transpiration'], correctIndex: 2, explanation: 'Photosynthesis uses light energy to convert carbon dioxide and water into sugars.', round: 2 },
  { id: 'r2-010', category: 'World Cultures', prompt: 'The traditional art of origami originated in which country?', options: ['Japan', 'India', 'Peru', 'Morocco'], correctIndex: 0, explanation: 'Origami is the Japanese art of paper folding.', round: 2 },
  { id: 'r2-011', category: 'Sports', prompt: 'How many rings appear on the Olympic symbol?', options: ['Four', 'Five', 'Six', 'Seven'], correctIndex: 1, explanation: 'The Olympic symbol contains five interlocking rings.', round: 2 },
  { id: 'r2-012', category: 'Music', prompt: 'Which instrument typically has 88 keys?', options: ['Harp', 'Piano', 'Accordion', 'Organ flute'], correctIndex: 1, explanation: 'A standard modern piano has 88 keys.', round: 2 },
  { id: 'r2-013', category: 'Science', prompt: 'Which gas makes up the largest share of Earth’s atmosphere?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], correctIndex: 2, explanation: 'Nitrogen makes up about 78% of Earth’s atmosphere.', round: 2 },
  { id: 'r2-014', category: 'Geography', prompt: 'Which is the smallest independent country by land area?', options: ['Monaco', 'San Marino', 'Liechtenstein', 'Vatican City'], correctIndex: 3, explanation: 'Vatican City is the smallest sovereign state by land area.', round: 2 },
  { id: 'r2-015', category: 'History', prompt: 'The Rosetta Stone helped scholars decipher which ancient writing system?', options: ['Egyptian hieroglyphs', 'Mayan glyphs', 'Linear A', 'Ogham'], correctIndex: 0, explanation: 'Its parallel inscriptions helped scholars decipher Egyptian hieroglyphs.', round: 2 },
  { id: 'r2-016', category: 'Movies', prompt: 'Which film series features the fictional school Hogwarts?', options: ['The Lord of the Rings', 'Harry Potter', 'The Hunger Games', 'The Chronicles of Narnia'], correctIndex: 1, explanation: 'Hogwarts School of Witchcraft and Wizardry appears in Harry Potter.', round: 2 },
  { id: 'r2-017', category: 'Maths', prompt: 'What is the sum of the interior angles of a triangle in Euclidean geometry?', options: ['90°', '180°', '270°', '360°'], correctIndex: 1, explanation: 'The interior angles of a triangle sum to 180° in Euclidean geometry.', round: 2 },
  { id: 'r2-018', category: 'African Knowledge', prompt: 'Which lake is the largest in Africa by surface area?', options: ['Lake Tanganyika', 'Lake Malawi', 'Lake Victoria', 'Lake Turkana'], correctIndex: 2, explanation: 'Lake Victoria is Africa’s largest lake by surface area.', round: 2 },
  { id: 'r2-019', category: 'Language', prompt: 'Which language has the most native speakers worldwide, according to widely used estimates?', options: ['English', 'Mandarin Chinese', 'Spanish', 'Arabic'], correctIndex: 1, explanation: 'Mandarin Chinese is generally estimated to have the most native speakers.', round: 2 },
  { id: 'r2-020', category: 'Astronomy', prompt: 'What is the name of our galaxy?', options: ['Andromeda', 'Whirlpool Galaxy', 'Milky Way', 'Sombrero Galaxy'], correctIndex: 2, explanation: 'Our Solar System is in the Milky Way galaxy.', round: 2 },

  // ROUND 3 — THE FINAL SHOWDOWN
  { id: 'r3-001', category: 'Science', prompt: 'Which scientist formulated the three laws of motion?', options: ['Albert Einstein', 'Isaac Newton', 'Galileo Galilei', 'Niels Bohr'], correctIndex: 1, explanation: 'Isaac Newton described his three laws of motion in Principia Mathematica.', round: 3 },
  { id: 'r3-002', category: 'Geography', prompt: 'Which mountain range traditionally forms part of the boundary between Europe and Asia?', options: ['The Andes', 'The Alps', 'The Ural Mountains', 'The Appalachians'], correctIndex: 2, explanation: 'The Ural Mountains are commonly used as part of the Europe–Asia boundary.', round: 3 },
  { id: 'r3-003', category: 'African History', prompt: 'Which ancient city in present-day Zimbabwe is the namesake of the Great Zimbabwe ruins?', options: ['Great Zimbabwe', 'Meroë', 'Carthage', 'Axum'], correctIndex: 0, explanation: 'Great Zimbabwe was a major medieval city and trading centre in southern Africa.', round: 3 },
  { id: 'r3-004', category: 'Technology', prompt: 'Which protocol is commonly used to securely browse websites?', options: ['FTP', 'HTTPS', 'SMTP', 'Telnet'], correctIndex: 1, explanation: 'HTTPS secures web traffic using TLS.', round: 3 },
  { id: 'r3-005', category: 'Logic', prompt: 'A farmer has 17 sheep. All but 9 run away. How many remain?', options: ['8', '9', '17', '0'], correctIndex: 1, explanation: 'All but 9 means 9 sheep remain.', round: 3 },
  { id: 'r3-006', category: 'Literature', prompt: 'Who wrote Things Fall Apart?', options: ['Ngũgĩ wa Thiong’o', 'Chinua Achebe', 'Wole Soyinka', 'Ben Okri'], correctIndex: 1, explanation: 'Chinua Achebe’s novel Things Fall Apart was published in 1958.', round: 3 },
  { id: 'r3-007', category: 'Science', prompt: 'What is the approximate speed of light in a vacuum?', options: ['30,000 km/s', '150,000 km/s', '300,000 km/s', '3,000,000 km/s'], correctIndex: 2, explanation: 'Light travels at about 299,792 kilometres per second in a vacuum.', round: 3 },
  { id: 'r3-008', category: 'Geography', prompt: 'Which desert covers much of northern Africa?', options: ['Gobi', 'Kalahari', 'Sahara', 'Atacama'], correctIndex: 2, explanation: 'The Sahara spans much of northern Africa.', round: 3 },
  { id: 'r3-009', category: 'History', prompt: 'Which civilisation built Machu Picchu?', options: ['Aztec', 'Inca', 'Maya', 'Olmec'], correctIndex: 1, explanation: 'Machu Picchu was built by the Inca in the Andes of present-day Peru.', round: 3 },
  { id: 'r3-010', category: 'Nature', prompt: 'What is the largest animal known to have ever lived?', options: ['African elephant', 'Megalodon', 'Blue whale', 'Argentinosaurus'], correctIndex: 2, explanation: 'The blue whale is the largest known animal by commonly accepted estimates.', round: 3 },
  { id: 'r3-011', category: 'Maths', prompt: 'What is the only even prime number?', options: ['0', '2', '4', '6'], correctIndex: 1, explanation: 'Two is prime and is the only even prime number.', round: 3 },
  { id: 'r3-012', category: 'World Cultures', prompt: 'Diwali is widely known as a festival of what?', options: ['Lights', 'Harvest rain', 'The sea', 'Winter snow'], correctIndex: 0, explanation: 'Diwali is widely known as the festival of lights.', round: 3 },
  { id: 'r3-013', category: 'Space', prompt: 'Which planet is known for its prominent ring system?', options: ['Mars', 'Venus', 'Saturn', 'Mercury'], correctIndex: 2, explanation: 'Saturn has the most prominent and extensive visible ring system.', round: 3 },
  { id: 'r3-014', category: 'Sports', prompt: 'In tennis, what score is called love?', options: ['Zero', 'Fifteen', 'Thirty', 'Forty'], correctIndex: 0, explanation: 'In tennis scoring, love means zero points.', round: 3 },
  { id: 'r3-015', category: 'Art', prompt: 'Which artist is strongly associated with the painting The Starry Night?', options: ['Claude Monet', 'Vincent van Gogh', 'Pablo Picasso', 'Edvard Munch'], correctIndex: 1, explanation: 'Vincent van Gogh painted The Starry Night in 1889.', round: 3 },
  { id: 'r3-016', category: 'African Knowledge', prompt: 'Which currency is used in Kenya?', options: ['Naira', 'Kenyan shilling', 'Cedi', 'Birr'], correctIndex: 1, explanation: 'Kenya’s currency is the Kenyan shilling.', round: 3 },
  { id: 'r3-017', category: 'Science', prompt: 'What is the pH of a neutral aqueous solution at about 25°C?', options: ['0', '5', '7', '14'], correctIndex: 2, explanation: 'A neutral aqueous solution has a pH of approximately 7 at 25°C.', round: 3 },
  { id: 'r3-018', category: 'Geography', prompt: 'Which ocean is the largest by surface area?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3, explanation: 'The Pacific Ocean is the largest of Earth’s oceans.', round: 3 },
  { id: 'r3-019', category: 'Logic', prompt: 'If you overtake the person in second place in a race, what place are you in?', options: ['First', 'Second', 'Third', 'Cannot be determined'], correctIndex: 1, explanation: 'You take second place when you overtake the runner in second.', round: 3 },
  { id: 'r3-020', category: 'History', prompt: 'The ancient Olympic Games originated in which country?', options: ['Italy', 'Egypt', 'Greece', 'Turkey'], correctIndex: 2, explanation: 'The ancient Olympic Games were held at Olympia in Greece.', round: 3 }
];

function shuffleQuestions<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function generateMatchQuestions(recentQuestionIds: Set<string>): Q[] {
  const selected: Q[] = [];

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const roundQuestions = questions.filter(q => q.round === round);
    const freshQuestions = roundQuestions.filter(q => !recentQuestionIds.has(q.id));

    // Prefer questions that were not used recently.
    // If too few fresh questions remain, allow the bank to be reused.
    const pool = freshQuestions.length >= QUESTIONS_PER_ROUND
      ? freshQuestions
      : roundQuestions;

    if (pool.length < QUESTIONS_PER_ROUND) {
      throw new Error(`Round ${round} needs at least ${QUESTIONS_PER_ROUND} questions.`);
    }

    selected.push(...shuffleQuestions(pool).slice(0, QUESTIONS_PER_ROUND));
  }

  if (selected.length !== QUESTIONS_PER_MATCH) {
    throw new Error('The match could not be filled with the required number of questions.');
  }

  return selected;
}

type Room = {
  code: string;
  hostId: string;
  phase: RoomState['phase'];
  players: Map<string, Player>;
  socketByPlayer: Map<string, string>;
  round: number;
  questionIndex: number;
  question?: Q;
  matchQuestions: Q[];
  questionStartedAt: number;
  questionEndsAt: number;
  timer?: NodeJS.Timeout;
  answers: Map<string, { index: number | null; at: number | null }>;
  scoresBefore: number;
  reveal?: RoomState['reveal'];
  winnerIds?: string[];
  recentQuestionIds: Set<string>;
};

const rooms = new Map<string, Room>();
const sessions = new Map<string, { code: string; playerId: string }>();

const cleanName = (v: unknown) =>
  String(v || '').trim().replace(/[<>]/g, '').slice(0, 18) || 'Scholar';

function code() {
  let s = '';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  do {
    s = Array.from({ length: 5 }, () => chars[randomInt(chars.length)]).join('');
  } while (rooms.has(s));

  return s;
}

function publicState(r: Room): RoomState {
  const players = [...r.players.values()].map(p => ({
    ...p,
    answer: undefined,
    answeredAt: undefined
  }));

  const q = r.question
    ? {
        id: r.question.id,
        category: r.question.category,
        prompt: r.question.prompt,
        options: r.question.options,
        round: r.question.round,
        questionNumber: r.questionIndex + 1,
        totalQuestions: r.matchQuestions.length,
        endsAt: r.questionEndsAt,
        doubleKnowledge: !!r.question.doubleKnowledge
      }
    : undefined;

  return {
    code: r.code,
    phase: r.phase,
    hostId: r.hostId,
    players,
    round: r.round,
    questionIndex: r.questionIndex,
    question: q,
    reveal: r.reveal,
    winnerIds: r.winnerIds
  };
}

function emit(r: Room) {
  io.to(r.code).emit('state:update', publicState(r));
}

function scoreOf(p: Player, q: Q, elapsedMs: number) {
  const elapsed = Math.max(0, Math.min(QUESTION_TIME_MS, elapsedMs));
  const remaining = Math.max(0, QUESTION_TIME_MS - elapsed);
  const base = 1000 + Math.floor(300 * remaining / QUESTION_TIME_MS);
  const powered = Math.floor(base * (p.usedGolden && q.round === 3 ? 1.5 : 1));

  return Math.min(1950, powered) + (q.doubleKnowledge ? 200 : 0);
}

function nextQuestion(r: Room) {
  if (r.timer) clearTimeout(r.timer);

  if (r.questionIndex >= r.matchQuestions.length) {
    finish(r);
    return;
  }

  r.question = r.matchQuestions[r.questionIndex];
  r.round = r.question.round;
  r.phase = 'question';
  r.answers.clear();
  r.reveal = undefined;
  r.questionStartedAt = Date.now();
  r.questionEndsAt = r.questionStartedAt + QUESTION_TIME_MS;

  r.players.forEach(p => {
    p.answer = undefined;
    p.answeredAt = undefined;
  });

  emit(r);
  r.timer = setTimeout(() => reveal(r), QUESTION_TIME_MS);
}

function reveal(r: Room) {
  if (r.phase !== 'question' || !r.question) return;
  if (r.timer) clearTimeout(r.timer);

  let correct = 0;

  for (const p of r.players.values()) {
    const answer = r.answers.get(p.id);

    if (answer && answer.index === r.question.correctIndex) {
      correct++;
      p.correct++;

      const elapsed = Math.max(
        0,
        (answer.at ?? Date.now()) - r.questionStartedAt
      );

      p.score += scoreOf(p, r.question, elapsed);
    }
  }

  r.phase = 'reveal';

  r.reveal = {
    correctIndex: r.question.correctIndex,
    explanation: r.question.explanation,
    answerStats: { correct, total: r.players.size },
    lastQuestion: r.questionIndex === r.matchQuestions.length - 1
  };

  emit(r);

  r.timer = setTimeout(() => {
    r.questionIndex++;

    if (r.questionIndex >= r.matchQuestions.length) {
      finish(r);
    } else {
      nextQuestion(r);
    }
  }, REVEAL_TIME_MS);
}

function finish(r: Room) {
  if (r.timer) clearTimeout(r.timer);

  r.phase = 'results';

  const sorted = [...r.players.values()].sort(
    (a, b) => b.score - a.score || b.correct - a.correct
  );

  if (sorted.length) {
    const top = sorted[0];

    r.winnerIds = sorted
      .filter(p => p.score === top.score && p.correct === top.correct)
      .map(p => p.id);
  }

  emit(r);
}

function leaveSocket(socket: Socket) {
  const session = sessions.get(socket.id);
  if (!session) return;

  sessions.delete(socket.id);

  const r = rooms.get(session.code);
  if (!r) return;

  const p = r.players.get(session.playerId);

  if (p) {
    p.connected = false;

    const sid = r.socketByPlayer.get(p.id);
    if (sid) r.socketByPlayer.delete(p.id);

    if (r.hostId === p.id) {
      const next = [...r.players.values()].find(
        player => player.connected && player.id !== p.id
      );

      if (next) r.hostId = next.id;
    }
  }

  emit(r);
}

io.on('connection', socket => {
  socket.on('room:create', (payload: { name?: string }, ack?: Function) => {
    const roomCode = code();
    const id = randomUUID();

    const player: Player = {
      id,
      name: cleanName(payload?.name),
      score: 0,
      connected: true,
      ready: true,
      isHost: true,
      correct: 0,
      usedOracle: false,
      usedGolden: false,
      usedChronos: false
    };

    const r: Room = {
      code: roomCode,
      hostId: id,
      phase: 'lobby',
      players: new Map([[id, player]]),
      socketByPlayer: new Map([[id, socket.id]]),
      round: 0,
      questionIndex: 0,
      matchQuestions: [],
      questionStartedAt: 0,
      questionEndsAt: 0,
      answers: new Map(),
      scoresBefore: 0,
      recentQuestionIds: new Set()
    };

    rooms.set(roomCode, r);
    sessions.set(socket.id, { code: roomCode, playerId: id });
    socket.join(roomCode);

    ack?.({ ok: true, code: roomCode, playerId: id });
    emit(r);
  });

  socket.on('room:join', (payload: { code?: string; name?: string }, ack?: Function) => {
    const roomCode = String(payload?.code || '').toUpperCase().trim();
    const r = rooms.get(roomCode);

    if (!r) {
      ack?.({ ok: false, message: 'That room code was not found.' });
      return;
    }

    if (r.phase !== 'lobby') {
      ack?.({ ok: false, message: 'This match has already started.' });
      return;
    }

    if (r.players.size >= 8) {
      ack?.({ ok: false, message: 'This room is full (8 players maximum).' });
      return;
    }

    const id = randomUUID();

    const player: Player = {
      id,
      name: cleanName(payload?.name),
      score: 0,
      connected: true,
      ready: true,
      isHost: false,
      correct: 0,
      usedOracle: false,
      usedGolden: false,
      usedChronos: false
    };

    r.players.set(id, player);
    r.socketByPlayer.set(id, socket.id);
    sessions.set(socket.id, { code: roomCode, playerId: id });
    socket.join(roomCode);

    ack?.({ ok: true, code: roomCode, playerId: id });
    emit(r);
  });

  socket.on('room:rematch', (_payload: unknown, ack?: Function) => {
    const session = sessions.get(socket.id);
    const r = session && rooms.get(session.code);
    const player = session && r?.players.get(session.playerId);

    if (!r || !player) {
      ack?.({ ok: false, message: 'Your room session could not be found.' });
      return;
    }

    if (r.phase !== 'results') {
      ack?.({ ok: false, message: 'A rematch is available after the final results.' });
      return;
    }

    if (r.players.size < 2) {
      ack?.({ ok: false, message: 'At least two players are needed for a rematch.' });
      return;
    }

    if (r.timer) clearTimeout(r.timer);

    r.phase = 'lobby';
    r.round = 0;
    r.questionIndex = 0;
    r.question = undefined;
    r.matchQuestions = [];
    r.reveal = undefined;
    r.winnerIds = undefined;
    r.answers.clear();

    r.players.forEach(p => {
      p.score = 0;
      p.correct = 0;
      p.usedOracle = false;
      p.usedGolden = false;
      p.usedChronos = false;
      p.answer = undefined;
      p.answeredAt = undefined;
    });

    ack?.({ ok: true });
    emit(r);
  });

  socket.on('room:start', (_payload: unknown, ack?: Function) => {
    const session = sessions.get(socket.id);
    const r = session && rooms.get(session.code);

    if (!r || r.hostId !== session?.playerId) {
      ack?.({ ok: false, message: 'Only the host can start the match.' });
      return;
    }

    if (r.players.size < 2) {
      ack?.({ ok: false, message: 'Invite at least one more player to begin.' });
      return;
    }

    r.players.forEach(p => {
      p.score = 0;
      p.correct = 0;
      p.usedOracle = false;
      p.usedGolden = false;
      p.usedChronos = false;
      p.answer = undefined;
      p.answeredAt = undefined;
    });

    try {
      r.matchQuestions = generateMatchQuestions(r.recentQuestionIds);

      r.matchQuestions.forEach(q => r.recentQuestionIds.add(q.id));

      // Clear the history when it grows too large.
      // The selector can then begin cycling through the bank again.
      if (r.recentQuestionIds.size >= questions.length) {
        r.recentQuestionIds.clear();
      }
    } catch (error) {
      console.error('Unable to select questions for match:', error);

      ack?.({
        ok: false,
        message: 'The question bank does not have enough questions for a match.'
      });

      return;
    }

    r.questionIndex = 0;
    r.reveal = undefined;
    r.winnerIds = undefined;

    ack?.({ ok: true });
    nextQuestion(r);
  });

  socket.on('answer:submit', (payload: { index: number }, ack?: Function) => {
    const session = sessions.get(socket.id);
    const r = session && rooms.get(session.code);
    const player = session && r?.players.get(session.playerId);

    if (!r || !player || r.phase !== 'question' || !r.question) {
      ack?.({ ok: false, message: 'There is no active question.' });
      return;
    }

    if (r.answers.has(player.id)) {
      ack?.({ ok: false, message: 'Your answer is already locked.' });
      return;
    }

    if (Date.now() > r.questionEndsAt) {
      ack?.({ ok: false, message: 'Time is up.' });
      return;
    }

    if (
      !Number.isInteger(payload?.index) ||
      payload.index < 0 ||
      payload.index > 3
    ) {
      ack?.({ ok: false, message: 'Invalid answer.' });
      return;
    }

    const answeredAt = Date.now();

    r.answers.set(player.id, {
      index: payload.index,
      at: answeredAt
    });

    player.answer = payload.index;
    player.answeredAt = answeredAt;

    ack?.({ ok: true });

    io.to(r.code).emit('answer:progress', {
      answered: r.answers.size,
      total: r.players.size
    });

    if (r.answers.size === r.players.size) {
      reveal(r);
    }
  });

  socket.on(
    'powerup:activate',
    (payload: { type: 'oracle' | 'golden' | 'chronos' }, ack?: Function) => {
      const session = sessions.get(socket.id);
      const r = session && rooms.get(session.code);
      const player = session && r?.players.get(session.playerId);

      if (!r || !player || r.phase !== 'question' || !r.question) {
        ack?.({
          ok: false,
          message: 'Power-ups can only be used during a question.'
        });
        return;
      }

      if (payload?.type === 'oracle') {
        if (r.round !== 2 || player.usedOracle) {
          ack?.({ ok: false, message: 'Oracle’s Insight is unavailable.' });
          return;
        }

        player.usedOracle = true;

        const wrong = r.question.options
          .map((_, i) => i)
          .filter(i => i !== r.question!.correctIndex);

        const remove = shuffleQuestions(wrong).slice(0, 2);

        ack?.({ ok: true, remove });
        return;
      }

      if (payload?.type === 'golden') {
        if (r.round !== 3 || player.usedGolden) {
          ack?.({ ok: false, message: 'Golden Focus is unavailable.' });
          return;
        }

        player.usedGolden = true;
        ack?.({ ok: true });
        return;
      }

      if (payload?.type === 'chronos') {
        if (r.round !== 3 || player.usedChronos) {
          ack?.({ ok: false, message: 'Chronos is unavailable.' });
          return;
        }

        player.usedChronos = true;

        // Preserve the existing client-facing event contract.
        ack?.({ ok: true, endsAt: r.questionEndsAt + 5_000 });
        return;
      }

      ack?.({ ok: false, message: 'Unknown power-up.' });
    }
  );

  socket.on(
    'session:resume',
    (payload: { code: string; playerId: string }, ack?: Function) => {
      const roomCode = String(payload?.code || '').toUpperCase();
      const r = rooms.get(roomCode);
      const player = r?.players.get(payload?.playerId);

      if (!r || !player) {
        ack?.({ ok: false, message: 'Session could not be restored.' });
        return;
      }

      const oldSocketId = r.socketByPlayer.get(player.id);

      if (oldSocketId && oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        oldSocket?.leave(r.code);
        sessions.delete(oldSocketId);
      }

      player.connected = true;
      r.socketByPlayer.set(player.id, socket.id);
      sessions.set(socket.id, { code: r.code, playerId: player.id });
      socket.join(r.code);

      ack?.({
        ok: true,
        code: r.code,
        playerId: player.id,
        state: publicState(r)
      });

      emit(r);
    }
  );

  socket.on('disconnect', () => leaveSocket(socket));
});

httpServer.listen(PORT, () => {
  console.log(`SOPHOS server listening on ${PORT}`);
});
