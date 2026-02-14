export type TutorialScreen = 'home' | 'chat' | 'feed';
export type FeedTabKey = 'transactions' | 'analytics' | 'health';

export type TutorialStep = {
  id: string;
  screen: TutorialScreen;
  title: string;
  body: string;
  primaryLabel: string;
  tab?: FeedTabKey;
  isFinal?: boolean;
  /** When true, dismiss modal and wait for user to feed Wynter before advancing. */
  waitForFeed?: boolean;
  /** When true, dismiss modal and wait for Wynter to reply in chat before advancing. */
  waitForChat?: boolean;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'home-intro',
    screen: 'home',
    title: 'Hey Ananya, meet Wynter',
    body: 'Wynter is your personal finance kitty. She tracks your spending, sets daily quests, and gets happier the smarter you save. Happy Valentine\'s Day!',
    primaryLabel: 'Next',
  },
  {
    id: 'home-feed',
    screen: 'home',
    title: 'Feeding Wynter',
    body: 'See the treats on the right? Drag one onto Wynter to feed her. Good money habits earn more treats.',
    primaryLabel: 'Try it!',
  },
  {
    id: 'home-feed-try',
    screen: 'home',
    title: 'Your turn!',
    body: 'Drag a treat onto Wynter now.',
    primaryLabel: '',
    waitForFeed: true,
  },
  {
    id: 'home-happiness',
    screen: 'home',
    title: 'The happiness meter',
    body: 'That bar at the bottom tracks Wynter\'s mood. Feed her, complete quests, and stay on budget to keep her happy. You\'ve got this!',
    primaryLabel: 'Let\'s go!',
    isFinal: true,
  },
];
