import { TextExport } from "@/components/teams/text-export";
import { serializeTeams } from "@/lib/teams";
import { useTeams } from "@/state/teams";

/** Every team as one block of text, to keep somewhere safe. */
export default function BackupScreen() {
  const { teams } = useTeams();
  return (
    <TextExport
      title="Back up teams"
      text={serializeTeams(teams)}
      note={`All ${teams.length} ${teams.length === 1 ? "team" : "teams"}, with notes and what each is for. Keep the text somewhere safe; pasting it into Import brings them back.`}
    />
  );
}
