TK=$(gcloud auth print-access-token)
RS=$(curl -s -H "Authorization: Bearer $TK" https://firebaserules.googleapis.com/v1/projects/autodeck-studio/releases/cloud.firestore | python3 -c 'import sys,json;print(json.load(sys.stdin)["rulesetName"])')
echo "$RS"
curl -s -H "Authorization: Bearer $TK" "https://firebaserules.googleapis.com/v1/$RS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["source"]["files"][0]["content"])' > /tmp/dep.rules
clear
wc -l /tmp/dep.rules firestore.rules
diff /tmp/dep.rules firestore.rules | head -16
