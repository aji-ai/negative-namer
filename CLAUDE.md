# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm run dev`
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`
- **Install dependencies**: `npm install`

## Architecture Overview

This is a simple Vite-based web application that creates a chat interface with OpenAI for generating negative/pessimistic names. The architecture is straightforward:

- **Frontend Stack**: Vanilla HTML/CSS/JavaScript with Vite for development tooling
- **API Integration**: Uses OpenAI JavaScript SDK with browser support enabled
- **Build System**: Vite handles bundling, hot reload, and environment variables

## Key Files

- `index.html`: Main HTML structure with chat interface
- `main.js`: Core application logic including OpenAI integration and DOM manipulation  
- `style.css`: Responsive CSS styling for chat interface
- `package.json`: Dependencies (OpenAI SDK, Vite) and build scripts

## OpenAI Integration

The app supports two ways to provide the OpenAI API key:
1. Environment variable: `VITE_OPENAI_API_KEY` in `.env` file
2. User input: API key entry field in the web interface

The OpenAI client is initialized with `dangerouslyAllowBrowser: true` to enable browser usage. The system prompt instructs the AI to create negative/pessimistic names while staying appropriate.

## Development Notes

- Uses ES6 modules with Vite's import system
- DOM manipulation is done with vanilla JavaScript
- Chat messages are dynamically created and managed with unique IDs
- Input validation and error handling for API calls included
- Responsive design works on both desktop and mobile