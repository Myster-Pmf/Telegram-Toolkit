# Telegram Toolkit

A comprehensive toolkit for power users, developers, and security researchers to monitor, analyze, and automate Telegram operations.

## Features

- 🔐 **Multi-Account Support** - Manage multiple Telegram accounts with fast switching
- 📊 **Cross-Account Analysis** - Analyze data across all your accounts
- 📦 **Full Account Archive** - Snapshot your entire account state
- 📡 **Real-time Monitoring** - Track messages, edits, deletions
- 👤 **User Profiling** - Build comprehensive user profiles
- 🤖 **LLM Integration** - AI-powered analysis and automation
- 🔧 **Raw Command Runner** - Execute MTProto commands directly

## Quick Start

```bash
# Install dependencies
pip install -e .

# Run the web dashboard
python -m src.main

# Or use CLI
tgtk --help
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## License

MIT
