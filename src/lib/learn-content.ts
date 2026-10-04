/**
 * Learn hub content. Static and typed for now; the shapes are what a future
 * content API would return, so pages only depend on these types.
 */

export type Homework = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  /** Days from the start of the week the task is due (0 = Monday). */
  dueWeekday: number;
  /** Practice sessions needed to reach 100%. */
  targetSessions: number;
  /** Suggested song name prefilled when the student submits a video. */
  songName: string;
  instrument: "PIANO" | "ACOUSTIC_GUITAR" | "KEYBOARD";
  lessonVideoUrl?: string;
};

export type SongNote = {
  id: string;
  emoji: string;
  title: string;
  artist: string;
  instrument: string;
  /** Simple letter notation the student can read without sheet music. */
  notes: string;
  level: string;
};

export type LessonVideo = {
  id: string;
  emoji: string;
  title: string;
  minutes: number;
  youtubeId: string;
};

export type Quiz = {
  id: string;
  prompt: string;
  clue: string;
  options: readonly string[];
  answer: string;
};

export const HOMEWORK: readonly Homework[] = [
  {
    id: "hw-twinkle",
    emoji: "🎹",
    title: "Twinkle Twinkle — Right Hand",
    subtitle: "Play slowly, then at full speed",
    dueWeekday: 1,
    targetSessions: 5,
    songName: "Twinkle Twinkle Little Star",
    instrument: "PIANO",
  },
  {
    id: "hw-c-major",
    emoji: "🎼",
    title: "C Major Scale — Both Hands",
    subtitle: "Two octaves, even tempo",
    dueWeekday: 4,
    targetSessions: 4,
    songName: "C Major Scale",
    instrument: "KEYBOARD",
  },
  {
    id: "hw-chords",
    emoji: "🎸",
    title: "G – C – D Chord Changes",
    subtitle: "Switch chords without stopping",
    dueWeekday: 6,
    targetSessions: 6,
    songName: "G C D Chord Practice",
    instrument: "ACOUSTIC_GUITAR",
  },
];

export const SONGS: readonly SongNote[] = [
  { id: "song-ode", emoji: "🎶", title: "Ode to Joy", artist: "Beethoven", instrument: "Piano", level: "Level 2", notes: "E E F G | G F E D | C C D E | E D D" },
  { id: "song-happy", emoji: "🎂", title: "Happy Birthday", artist: "Traditional", instrument: "Piano", level: "Level 1", notes: "G G A G C B | G G A G D C" },
  { id: "song-smoke", emoji: "🎸", title: "Riff Practice", artist: "Shred Sound", instrument: "Guitar", level: "Level 3", notes: "0-3-5 | 0-3-6-5 | 0-3-5 | 3-0" },
  { id: "song-jingle", emoji: "🔔", title: "Jingle Bells", artist: "Traditional", instrument: "Keyboard", level: "Level 1", notes: "E E E | E E E | E G C D E" },
];

export const LESSON_VIDEOS: readonly LessonVideo[] = [];

export const QUIZZES: readonly Quiz[] = [
  {
    id: "quiz-twinkle",
    prompt: "🎵 Guess This Song!",
    clue: "C C G G A A G …",
    options: ["Happy Birthday", "Twinkle Twinkle", "Jingle Bells", "Ode to Joy"],
    answer: "Twinkle Twinkle",
  },
  {
    id: "quiz-ode",
    prompt: "🎵 Guess This Song!",
    clue: "E E F G G F E D …",
    options: ["Ode to Joy", "Für Elise", "Happy Birthday", "Mary Had a Little Lamb"],
    answer: "Ode to Joy",
  },
  {
    id: "quiz-mary",
    prompt: "🎵 Guess This Song!",
    clue: "E D C D E E E …",
    options: ["Jingle Bells", "Twinkle Twinkle", "Mary Had a Little Lamb", "Old MacDonald"],
    answer: "Mary Had a Little Lamb",
  },
  {
    id: "quiz-jingle",
    prompt: "🎵 Guess This Song!",
    clue: "E E E · E E E · E G C D E …",
    options: ["Silent Night", "Jingle Bells", "Ode to Joy", "Happy Birthday"],
    answer: "Jingle Bells",
  },
];

export function findHomework(id: string) {
  return HOMEWORK.find((h) => h.id === id);
}

export function findQuiz(id: string) {
  return QUIZZES.find((q) => q.id === id);
}

/** A different quiz each day, the same one for everybody. */
export function quizOfTheDay(now: Date = new Date()): Quiz {
  const day = Math.floor(now.getTime() / 86_400_000);
  return QUIZZES[day % QUIZZES.length];
}

/** Human due label + colour tone for a homework card. */
export function dueLabel(hw: Homework, now: Date = new Date()) {
  const weekday = (now.getUTCDay() + 6) % 7; // Monday = 0
  const diff = (hw.dueWeekday - weekday + 7) % 7;
  if (diff === 0) return { label: "Due: Today", tone: "urgent" as const };
  if (diff === 1) return { label: "Due: Tomorrow", tone: "urgent" as const };
  const name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][hw.dueWeekday];
  if (diff <= 3) return { label: `Due: ${name}`, tone: "muted" as const };
  return { label: "Due: This week", tone: "ok" as const };
}
