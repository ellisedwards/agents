export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "centurion", name: "Centurion", description: "Reach level 50", icon: "\u{1F451}" },
  { id: "polymath", name: "Polymath", description: "Master 5+ different tools", icon: "\u{1F9E0}" },
  { id: "marathon", name: "Marathon", description: "Maintain a 2-hour streak", icon: "\u{1F3C3}" },
  { id: "shell-shocked", name: "Shell Shocked", description: "Use Bash 1000 times", icon: "\u{1F41A}" },
  { id: "critical-mass", name: "Critical Mass", description: "Land 100 critical hits", icon: "\u{1F4A5}" },
];
