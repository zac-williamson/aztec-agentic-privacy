#!/bin/bash
# NIST RFI Comment Submission Script
# Docket: NIST-2025-0035
# Document: NIST-2025-0035-0001
# Deadline: March 9, 2026 at 11:59 PM Eastern Time
#
# PREREQUISITES:
# 1. Register for a free API key at: https://api.data.gov/signup/
# 2. Wait for email verification (usually instant)
# 3. Set your API key below: export REGULATIONS_GOV_API_KEY="your_key_here"
#
# USAGE:
#   export REGULATIONS_GOV_API_KEY="your_key_here"
#   bash submit-nist-comment.sh
#
# ALTERNATIVE (manual web submission):
#   Go to: https://www.regulations.gov/commenton/NIST-2025-0035-0001
#   Click "Comment Now!", paste the content from NIST-SUBMISSION-COMMENT.txt

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMENT_FILE="${SCRIPT_DIR}/NIST-SUBMISSION-COMMENT.txt"

# Check API key
if [ -z "${REGULATIONS_GOV_API_KEY}" ]; then
    echo "ERROR: REGULATIONS_GOV_API_KEY not set"
    echo ""
    echo "To get a free API key:"
    echo "  1. Go to: https://api.data.gov/signup/"
    echo "  2. Fill in your details (name, email, use description)"
    echo "  3. Check your email for the API key"
    echo "  4. Run: export REGULATIONS_GOV_API_KEY=\"your_key\""
    echo "  5. Re-run this script"
    echo ""
    echo "OR submit manually at:"
    echo "  https://www.regulations.gov/commenton/NIST-2025-0035-0001"
    exit 1
fi

# Read and escape the comment text
COMMENT_TEXT=$(cat "${COMMENT_FILE}")

# Build the JSON payload
PAYLOAD=$(python3 -c "
import json, sys

with open('${COMMENT_FILE}', 'r') as f:
    comment_text = f.read()

payload = {
    'data': {
        'attributes': {
            'commentOnDocumentId': 'NIST-2025-0035-0001',
            'comment': comment_text,
            'firstName': 'Nullius',
            'lastName': '(The Isnad Chain Project)',
            'organization': 'The Isnad Chain Project'
        },
        'type': 'comments'
    }
}

print(json.dumps(payload))
")

echo "=== NIST RFI Comment Submission ==="
echo "Docket: NIST-2025-0035"
echo "Document: NIST-2025-0035-0001"
echo "Title: Security Considerations for Artificial Intelligence Agents"
echo "Deadline: March 9, 2026, 11:59 PM ET"
echo ""
echo "Submitting comment..."
echo ""

# Submit the comment
RESPONSE=$(curl -s -X POST \
    "https://api.regulations.gov/v4/comments" \
    -H "Content-Type: application/vnd.api+json" \
    -H "X-Api-Key: ${REGULATIONS_GOV_API_KEY}" \
    -d "${PAYLOAD}" \
    --max-time 30)

echo "Response from regulations.gov:"
echo "${RESPONSE}"

# Check if successful
if echo "${RESPONSE}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
comment_id = data.get('data', {}).get('id', '')
if comment_id:
    print()
    print('SUCCESS! Comment submitted.')
    print('Comment ID:', comment_id)
    print()
    print('View your comment at:')
    print('https://www.regulations.gov/comment/' + comment_id)
    sys.exit(0)
else:
    error = data.get('errors', [{}])[0].get('detail', 'Unknown error')
    print('ERROR:', error, file=sys.stderr)
    sys.exit(1)
" 2>/dev/null; then
    echo ""
    echo "Submission complete. The comment will be publicly available"
    echo "at regulations.gov within 1-3 business days."
    echo ""
    echo "Full submission details available at:"
    echo "https://github.com/zac-williamson/aztec-agentic-privacy/blob/main/NIST-RFI-SUBMISSION.md"
else
    echo ""
    echo "Submission may have failed. Check the response above."
    echo ""
    echo "Manual submission URL:"
    echo "https://www.regulations.gov/commenton/NIST-2025-0035-0001"
fi
