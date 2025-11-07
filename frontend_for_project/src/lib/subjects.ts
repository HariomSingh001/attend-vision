import { ReactNode, createElement } from "react";
import { Book, Library, Network, Cpu } from "lucide-react";
import { IoLogoPython } from "react-icons/io5";
import { PiVirtualRealityFill } from "react-icons/pi";

export type ApiSubject = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  slug?: string | null;
};

export type SubjectDisplay = ApiSubject & {
  slug: string;
  displayName: string;
  icon: ReactNode;
};

const ICON_CLASS = "w-8 h-8 text-primary";

const ICON_MAP: Record<string, () => ReactNode> = {
  "multimedia-virtual-reality": () => createElement(PiVirtualRealityFill, { className: ICON_CLASS }),
  python: () => createElement(IoLogoPython, { className: ICON_CLASS }),
  flat: () => createElement(Book, { className: ICON_CLASS }),
  "computer-network": () => createElement(Network, { className: ICON_CLASS }),
  microprocessor: () => createElement(Cpu, { className: ICON_CLASS }),
  default: () => createElement(Library, { className: ICON_CLASS }),
};

export function createSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "subject";
}

export function formatSubjectsForDisplay(subjects: ApiSubject[]): SubjectDisplay[] {
  return subjects.map((subject) => {
    const slug = subject.slug ? String(subject.slug) : createSlug(subject.name || subject.id);
    const displayName = subject.code
      ? `${subject.name || "Untitled Subject"} (${subject.code})`
      : subject.name || "Untitled Subject";

    return {
      ...subject,
      slug,
      displayName,
      icon: (ICON_MAP[slug] || ICON_MAP.default)(),
    };
  });
}
