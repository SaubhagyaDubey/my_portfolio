# My Portfolio

Personal portfolio site built with [React](https://react.dev/) and [Vite](https://vite.dev/).

## Getting started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5173 with hot module replacement.

## Scripts

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start the development server                |
| `npm run build`   | Build for production into `dist/`           |
| `npm run preview` | Serve the production build locally          |
| `npm run lint`    | Lint the project with Oxlint                |

## Project structure

```
public/              Static files served as-is (favicon, resume PDF, etc.)
src/
  components/        Page sections (Header, Hero, About, Experience, Projects, Skills, Contact, Footer)
  data/portfolio.js  All site content: profile, stats, about text, education, experience, projects, skills, socials
  App.jsx            Page layout
  App.css            Section and layout styles
  index.css          Theme tokens (light/dark) and base styles
  main.jsx           App entry point
```

## Editing content

Update `src/data/portfolio.js` to change your name, bio, experience, skills, projects, and contact links. The components read from that file, so most content changes don't need any component edits.
