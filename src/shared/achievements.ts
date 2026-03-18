export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-blood", name: "First Blood", description: "Use your first tool", icon: "\u{1FA78}" },
  { id: "speed-runner", name: "Speed Runner", description: "Reach level 5 in under 30 minutes", icon: "\u26A1" },
  { id: "polymath", name: "Polymath", description: "Master 3+ different tools", icon: "\u{1F9E0}" },
  { id: "marathon", name: "Marathon", description: "Maintain a streak for 30+ minutes", icon: "\u{1F3C3}" },
  { id: "critical-master", name: "Critical Master", description: "Land 10 critical hits", icon: "\u{1F4A5}" },
  { id: "team-player", name: "Team Player", description: "Earn 50+ rivalry bonus exp", icon: "\u{1F91D}" },
  { id: "shell-shocked", name: "Shell Shocked", description: "Use Bash 200 times", icon: "\u{1F41A}" },
  { id: "bookworm", name: "Bookworm", description: "Use Read 200 times", icon: "\u{1F4DA}" },
];
