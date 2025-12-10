# Security Guidelines

## 🔐 API Key Management

### Critical Rules

1. **NEVER commit API keys to Git**
   - All API keys must be in `.env.local` (which is gitignored)
   - Use `.env.example` as a template only
   - Double-check before committing: `git diff` to ensure no keys are included

2. **Environment Variables**
   - All sensitive data must use `process.env.VARIABLE_NAME`
   - Never hardcode API keys in source code
   - Use Vercel environment variables for production

3. **Git History**
   - If you accidentally commit a key, **immediately**:
     1. Rotate/regenerate the exposed key
     2. Remove it from Git history using `git filter-branch` or BFG Repo-Cleaner
     3. Force push: `git push --force`
     4. Notify team members to re-clone the repository

## 🛡️ API Key Security Checklist

### Before Every Commit

```bash
# Check for potential API keys
git diff | grep -i "api_key\|secret\|password\|sk-"

# Verify .env.local is not staged
git status | grep ".env.local"

# Double check .gitignore includes .env*
cat .gitignore | grep ".env"
```

### Required Environment Variables

See `.env.example` for the complete list:
- `OPENAI_API_KEY` - OpenAI API key (starts with sk-)
- `GEMINI_API_KEY` - Google Gemini API key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `CRON_SECRET` - Secret for cron job authentication

## 🚨 What to Do If a Key is Exposed

### Immediate Actions

1. **Rotate the key immediately**
   - OpenAI: https://platform.openai.com/api-keys
   - Supabase: Project Settings → API
   - Google Cloud: API & Services → Credentials

2. **Review usage logs**
   - Check for unauthorized usage
   - Monitor billing for unexpected charges

3. **Clean Git history** (if committed)
   ```bash
   # Using BFG Repo-Cleaner (recommended)
   bfg --replace-text passwords.txt
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push --force
   ```

4. **Update deployed environments**
   - Update Vercel environment variables
   - Redeploy the application

## 📋 Best Practices

1. **Use separate keys for development and production**
2. **Implement rate limiting** on API endpoints
3. **Monitor API usage** regularly
4. **Use Vercel's built-in secrets** for production
5. **Enable 2FA** on all service accounts (OpenAI, Supabase, etc.)
6. **Regularly rotate keys** (every 90 days recommended)

## 🔍 Automated Security Checks

### Pre-commit Hook (Optional)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check for potential secrets
if git diff --cached | grep -i "sk-\|api_key.*=.*[a-zA-Z0-9]\{20,\}\|secret.*=.*[a-zA-Z0-9]\{20,\}"; then
    echo "⚠️  WARNING: Potential API key detected!"
    echo "Please remove sensitive data before committing."
    exit 1
fi
```

Make it executable: `chmod +x .git/hooks/pre-commit`

## 📞 Security Contact

If you discover a security vulnerability, please contact the project maintainers immediately.

---

**Remember: Security is everyone's responsibility. When in doubt, ask!**
