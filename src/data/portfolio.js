// Site content lives here. The components read from this file, so most content changes don't need component edits.

export const profile = {
  name: 'Saubhagya Dubey',
  role: 'Mobile Engineering Lead',
  tagline: 'I build and scale Flutter practices, and ship apps used by millions.',
  email: 'dubeysaubhagya@gmail.com',
  location: 'New Delhi, India',
}

export const stats = [
  { value: '6+', label: 'Years in mobile engineering' },
  { value: '1M+', label: 'Downloads on a single app' },
  { value: '20+', label: 'Engineers trained in Flutter' },
  { value: '₹5–10 Cr', label: 'Daily payment volume handled' },
]

export const about = [
  'Mobile engineering leader with 6+ years building and scaling Flutter practices across fintech, logistics, sports, and healthtech. I have established Flutter from zero at three companies, growing teams up to 20 engineers and shipping apps with 1M+ downloads and ₹5–10 crore in daily payment volume.',
  'I am strong on architecture (BLoC, Riverpod, monorepos with Melos), performance optimization, fragment shaders, and end-to-end delivery, from contract design through Play Store and App Store launch. I am comfortable owning the mobile track end to end: hiring, mentoring, CI/CD, testing strategy, and stakeholder alignment.',
]

export const education = [
  {
    degree: 'B.Tech, Computer Science',
    school: 'Galgotias University, Greater Noida',
    start: '2016',
    end: '2020',
  },
]

export const experience = [
  {
    role: 'Mobile Engineer (A3)',
    company: 'Tide Platforms',
    location: 'Delhi NCR',
    note: 'UK fintech for SMEs',
    start: 'Aug 2025',
    end: 'Present',
    points: [
      'Owned end-to-end delivery of core monetization features on iOS and Android: annual subscriptions, cancellation flows with retention rules, per-seat charging, and add-on upgrades and downgrades.',
      'Supported the launch in DE markets with Lokalise integration for localization at scale across the existing monorepo.',
      'Established team-wide engineering practices: introduced FE-spec and contract-model documentation as the default for backend-frontend alignment, and proposed a standardized Jira ticket template now under discussion.',
    ],
    tech: ['Flutter', 'Dart', 'BLoC', 'Dependency injection', 'Patrol', 'Melos monorepo', 'uniclient SDK'],
  },
  {
    role: 'Senior Software Engineer, Mobile Lead',
    company: 'DTDC Couriers & Supply Chain Solutions',
    location: 'Gurugram',
    start: 'May 2024',
    end: 'Aug 2025',
    points: [
      'Built the mobile team from scratch: hired and led 5 Flutter engineers, and defined the architecture, CI/CD, code review standards, and release cycle.',
      "Architected the delivery executive app for real-time tracking and last-mile delivery management, designed to onboard 5,000+ delivery partners across DTDC's network.",
      'Led automation of channel partner territory management, eliminating manual parcel sorting at hub level and reducing human error in route assignment.',
      'Drove cross-functional alignment with backend, ops, and product teams on API contracts, data flows, and rollout strategy.',
    ],
  },
  {
    role: 'Flutter Developer',
    company: 'Ok2 Health Apps',
    location: 'Remote',
    start: 'Oct 2023',
    end: 'Mar 2024',
    points: [
      'Refactored a 50,000-line Flutter codebase down to 7,000 lines by migrating from setState and Provider to BLoC, unifying business logic, and increasing widget reusability.',
      'Contributed to the Go backend to ship features end to end across mobile and server layers.',
    ],
  },
  {
    role: 'Flutter Lead, Senior Software Engineer',
    company: 'Super Six Sports Gaming',
    location: 'Noida',
    start: 'May 2022',
    end: 'Oct 2023',
    points: [
      'Led a team of 5 to launch three flagship apps on the Play Store and App Store: USQ, VUSport, and Fantasy Akhada.',
      'Shipped at scale: Fantasy Akhada crossed 1M+ downloads, VUSport reached 800K+, and USQ launched with 5K downloads on day one.',
      'Built live sports streaming infrastructure with real-time match stats and player data, sustaining 100K+ concurrent live streams during the Messi friendly match.',
      'Owned the payments architecture: integrated Juspay, Razorpay, and Cashfree, processing roughly ₹5–10 crore in daily transactions during IPL season.',
      'Designed core microservices for notifications and authentication, including LLD/HLD documentation and reliability targets.',
    ],
  },
  {
    role: 'Senior Flutter Developer',
    company: 'Elixia Tech',
    location: 'Mumbai',
    start: 'Sep 2021',
    end: 'May 2022',
    points: [
      'Migrated three AngularJS applications to Flutter Web with full feature parity and improved performance.',
      'Built the Maersk Appointment System for warehouse congestion management, helping prevent deadlocks at port-side facilities.',
    ],
  },
  {
    role: 'Associate Tech / Jr. Associate Tech',
    company: 'Unthinkable Solutions',
    location: 'Gurugram',
    start: 'Jan 2020',
    end: 'Sep 2021',
    points: [
      'Established Flutter as a practice from zero: trained and onboarded 20+ junior and senior engineers into a production-ready Flutter team. Two of them now work alongside me at Tide.',
      'Built multiple POCs that converted into client engagements, helping Unthinkable expand its mobile offering.',
      'Resolved critical issues in client-facing projects, protecting key accounts and preventing escalations.',
    ],
  },
]

export const projects = [
  {
    title: 'Fantasy Akhada, VUSport & USQ',
    description:
      'Three sports apps launched on the Play Store and App Store with a team of 5. Fantasy Akhada crossed 1M+ downloads and VUSport reached 800K+. The platform sustained 100K+ concurrent live streams and ₹5–10 crore in daily payments during IPL season.',
    tech: ['Flutter', 'Live streaming', 'Juspay', 'Razorpay', 'Cashfree'],
    liveUrl: '',
    sourceUrl: '',
  },
  {
    title: 'DTDC Delivery Executive App',
    description:
      'Real-time tracking and last-mile delivery management app, architected to onboard 5,000+ delivery partners across the DTDC network.',
    tech: ['Flutter', 'CI/CD', 'Real-time tracking'],
    liveUrl: '',
    sourceUrl: '',
  },
  {
    title: 'Retire 100',
    description:
      'Freelance work for an HDFC-backed product. Cut Flutter Web load times from 60+ seconds to 10–14 seconds through bundle splitting, lazy loading, and asset optimization.',
    tech: ['Flutter Web', 'Performance'],
    liveUrl: '',
    sourceUrl: '',
  },
  {
    title: 'Ok2 Health Refactor',
    description:
      'Shrank a 50,000-line Flutter codebase to 7,000 lines by moving from setState and Provider to BLoC and unifying business logic.',
    tech: ['Flutter', 'BLoC', 'Go'],
    liveUrl: '',
    sourceUrl: '',
  },
  {
    title: 'Maersk Appointment System',
    description:
      'Warehouse congestion management system that helps prevent deadlocks at port-side facilities.',
    tech: ['Flutter Web'],
    liveUrl: '',
    sourceUrl: '',
  },
]

export const skillGroups = [
  {
    label: 'Mobile & Web',
    items: ['Flutter', 'Dart', 'Flutter Web', 'Fragment shaders', 'Flutter animations', 'Flutter Painting', 'React', 'JavaScript'],
  },
  {
    label: 'Architecture & State',
    items: ['BLoC', 'Riverpod', 'Provider', 'GetX', 'Melos monorepo', 'Dependency injection', 'Clean architecture'],
  },
  {
    label: 'Backend',
    items: ['Go', 'MySQL', 'Firebase', 'Firestore', 'FCM', 'REST', 'Microservices design'],
  },
  {
    label: 'Testing',
    items: ['Patrol', 'Flutter Integration Test', 'Flutter Driver', 'Golden tests', 'Mocked DI layers'],
  },
  {
    label: 'Networking & Tooling',
    items: ['DIO', 'Retrofit', 'Auto Router', 'Lokalise', 'l10n / i18n', 'GitLab CI', 'Xcode Cloud'],
  },
  {
    label: 'Payments',
    items: ['Juspay', 'Razorpay', 'Cashfree'],
  },
  {
    label: 'Leadership',
    items: ['Hiring', 'Mentoring', 'Architecture review', 'Sprint planning', 'Stakeholder management', 'Cross-functional alignment'],
  },
]

export const socials = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/saubhagya-dubey' },
]
