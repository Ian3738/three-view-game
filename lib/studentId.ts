// 學生身分：班級（自由輸入字串）+ 座號（1-99 整數）
// 組合成 ID：`{class}-{padded seat}`，例如 "701-05"。
// 存在 localStorage，所有需要識別玩家的地方都從這裡讀。

const STUDENT_KEY = "tvg.student";

export type Student = {
  classCode: string; // 例如 "701"、"七年一班"
  seatNo: number; // 1-99
};

export function studentToId(s: Student): string {
  return `${s.classCode.trim()}-${String(s.seatNo).padStart(2, "0")}`;
}

export function loadStudent(): Student | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STUDENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.classCode === "string" &&
      typeof parsed?.seatNo === "number" &&
      parsed.classCode.trim().length > 0 &&
      parsed.seatNo >= 1 &&
      parsed.seatNo <= 99
    ) {
      return { classCode: parsed.classCode.trim(), seatNo: parsed.seatNo };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveStudent(s: Student) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STUDENT_KEY, JSON.stringify(s));
}

export function clearStudent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STUDENT_KEY);
}

export function loadStudentId(): string | null {
  const s = loadStudent();
  return s ? studentToId(s) : null;
}
