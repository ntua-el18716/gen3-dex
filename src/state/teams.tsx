import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Game } from "@/db/schema";
import { readPreference, writePreference } from "@/lib/preferences";
import {
  newTeam,
  parseTeams,
  serializeTeams,
  type Team,
  type TeamPurpose,
} from "@/lib/teams";

/**
 * The user's teams, kept on the device. They live in the preferences store
 * (not in gen3.db, which is read-only and replaced by every app update), as
 * one JSON document; lib/teams.ts checks it when loading.
 */
const STORAGE_KEY = "teams";

type TeamsStore = {
  /** Most recently changed first. */
  teams: Team[];
  /** Adds an empty team and returns its id. */
  createTeam: (game: Game, purpose?: TeamPurpose) => string;
  /** Adds finished teams (from an import) and returns their new ids. */
  addTeams: (teams: Omit<Team, "id" | "updatedAt">[]) => string[];
  /** Replaces a team with `change(team)`. */
  updateTeam: (id: string, change: (team: Team) => Team) => void;
  deleteTeam: (id: string) => void;
};

const TeamsContext = createContext<TeamsStore | null>(null);

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState(() =>
    parseTeams(readPreference(STORAGE_KEY)),
  );
  // Saved after every change; the document is small (a few kB).
  useEffect(() => {
    writePreference(STORAGE_KEY, serializeTeams(teams));
  }, [teams]);

  const createTeam = useCallback((game: Game, purpose?: TeamPurpose) => {
    const id = newId();
    const team = newTeam(id, Date.now(), game, purpose);
    setTeams((all) => [team, ...all]);
    return id;
  }, []);
  const addTeams = useCallback((incoming: Omit<Team, "id" | "updatedAt">[]) => {
    const now = Date.now();
    // Later teams a millisecond older, so they list in the order given.
    const added = incoming.map((t, i) => ({
      ...t,
      id: newId(),
      updatedAt: now - i,
    }));
    setTeams((all) => [...added, ...all]);
    return added.map((t) => t.id);
  }, []);
  const updateTeam = useCallback((id: string, change: (team: Team) => Team) => {
    const now = Date.now();
    setTeams((all) =>
      all.map((t) => (t.id === id ? { ...change(t), id, updatedAt: now } : t)),
    );
  }, []);
  const deleteTeam = useCallback((id: string) => {
    setTeams((all) => all.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      teams: [...teams].sort((a, b) => b.updatedAt - a.updatedAt),
      createTeam,
      addTeams,
      updateTeam,
      deleteTeam,
    }),
    [teams, createTeam, addTeams, updateTeam, deleteTeam],
  );
  return <TeamsContext value={value}>{children}</TeamsContext>;
}

export function useTeams(): TeamsStore {
  const value = use(TeamsContext);
  if (!value) throw new Error("useTeams must be used inside <TeamsProvider>");
  return value;
}

/** One team by id (undefined once it's deleted). */
export function useTeam(id: string): Team | undefined {
  return useTeams().teams.find((t) => t.id === id);
}
