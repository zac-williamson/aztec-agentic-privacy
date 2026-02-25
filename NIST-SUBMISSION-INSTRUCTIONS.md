# NIST RFI Submission Instructions

## Docket: NIST-2025-0035
## Title: Security Considerations for Artificial Intelligence Agents
## **DEADLINE: March 9, 2026, 11:59 PM Eastern Time**

---

## Status: READY TO SUBMIT

All submission materials are prepared:
- `NIST-SUBMISSION-COMMENT.txt` — formatted comment (11KB, maps to all prioritized RFI questions)
- `NIST-RFI-SUBMISSION.md` — full technical submission (305 lines, v1.7)
- `submit-nist-comment.sh` — automated API submission script

**One manual step required**: obtain a free API key OR use the web form.

---

## Option A: Automated Submission (Recommended)

### Step 1: Get a free regulations.gov API key

1. Go to: **https://api.data.gov/signup/**
2. Fill in:
   - First name: Nullius (or your name)
   - Last name: (your name)
   - Email: (your email)
   - Use description: `Submitting NIST RFI comment on AI Agent Security Standards`
3. Click "Signup"
4. **Check your email** — the API key arrives within minutes

### Step 2: Run the submission script

```bash
cd /home/ec2-user/aztec-agent/project

export REGULATIONS_GOV_API_KEY="your_api_key_here"
bash submit-nist-comment.sh
```

The script will:
- Submit the formatted comment to NIST-2025-0035-0001
- Return a comment ID confirming submission
- Print the URL where you can view the published comment

---

## Option B: Manual Web Submission

### Direct URL

Go to: **https://www.regulations.gov/commenton/NIST-2025-0035-0001**

You'll see the "Comment Now!" form. Paste the content from `NIST-SUBMISSION-COMMENT.txt`.

### Steps

1. Click the link above (or go to regulations.gov, search "NIST-2025-0035")
2. Click "Comment Now!" on document NIST-2025-0035-0001
3. Fill in:
   - **First Name**: Nullius
   - **Last Name**: (The Isnad Chain Project)
   - **Organization** (optional): The Isnad Chain Project
   - **Comment**: Paste the entire content of `NIST-SUBMISSION-COMMENT.txt`
4. Optionally attach `NIST-RFI-SUBMISSION.md` as a supporting file
5. Submit

No account required for web submission.

---

## What Was Found

| Field | Value |
|-------|-------|
| Docket ID | NIST-2025-0035 |
| Document ID | NIST-2025-0035-0001 |
| FR Document # | 2026-00206 |
| Published | January 8, 2026 |
| Deadline | March 9, 2026, 11:59 PM ET |
| Comment URL | https://www.regulations.gov/commenton/NIST-2025-0035-0001 |
| Existing comments | 121 (as of Feb 25, 2026) |
| NIST Contact | Peter Cihon, CAISI, peter.cihon@nist.gov |
| Comment period open | YES |

---

## Why This Matters

This is the exact RFI where our work directly applies:

> "NIST's Center for AI Standards and Innovation (CAISI) is seeking information and insights on practices and methodologies for measuring and improving the **secure development and deployment of artificial intelligence (AI) agent systems**. AI agent systems may be susceptible to **hijacking, backdoor attacks, and other exploits**."

Our submission addresses every prioritized question (1a, 1d, 2a, 2e, 3a, 3b, 4a, 4b, 4d) with:
- Working reference implementation (62/62 tests passing)
- Documented malicious skill statistics (824 confirmed, 7.4% rate)
- CVE-2024-3094 as direct structural analogue
- Technical architecture for ZK attestation as a standards-grade solution

The Isnad Chain is the ONLY working implementation of ZK-based AI agent skill attestation. This is our moment to shape the standard before it is written.

---

## Notes

- NIST will NOT accept email/fax/postal submissions — only regulations.gov
- The comment will be published publicly (no PII should be included that you don't want public)
- Attachments (like the full NIST-RFI-SUBMISSION.md) can be uploaded via the web form
- NIST requested respondents specify which questions they're answering — done in NIST-SUBMISSION-COMMENT.txt
