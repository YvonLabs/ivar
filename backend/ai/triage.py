import os
import json
import re
from dataclasses import dataclass

def _strip_html(text: str) -> str:
    if not text: return ""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


@dataclass
class TriageResult:
    severity: str
    summary: str
    confidence: float
    method: str
    stack_match: bool


def get_org_context(db=None) -> dict:
    if db:
        from db.models import get_org
        org = get_org(db)
        return {
            "name": org.name,
            "sector": org.sector,
            "size": org.size,
            "stack": org.stack or [],
            "ai_provider": org.ai_provider,
            "ai_api_key": org.ai_api_key,
            "ai_model": org.ai_model,
        }
    return {
        "name": os.getenv("ORG_NAME", "My Org"),
        "sector": os.getenv("ORG_SECTOR", "software"),
        "size": os.getenv("ORG_SIZE", "medium"),
        "stack": [s.strip() for s in os.getenv("ORG_STACK", "github,docker,postgresql").split(",")],
        "ai_provider": "none",
        "ai_api_key": None,
        "ai_model": None,
    }


def triage_rules(signal_data: dict, org: dict) -> TriageResult:
    org_stack = [s.lower() for s in (org.get("stack") or [])]
    vendors = [v.lower() for v in (signal_data.get("affected_vendors") or [])]
    stack_match = any(
        any(sv in v or v in sv for sv in org_stack)
        for v in vendors
    )
    base_severity = signal_data.get("severity_hint") or "ROUTINE"
    if stack_match and base_severity == "FLASH":
        severity = "FLASH"
    elif stack_match:
        severity = "PRIORITY"
    else:
        severity = base_severity

    vendor_str = ", ".join(vendors[:3]) if vendors else "unknown vendors"
    match_note = "Directly affects your stack." if stack_match else "No direct stack match detected."
    summary = f"Affects {vendor_str}. {match_note}"

    return TriageResult(
        severity=severity,
        summary=summary,
        confidence=0.75 if stack_match else 0.5,
        method="rule_based",
        stack_match=stack_match,
    )


async def triage_claude(signal_data: dict, org: dict) -> TriageResult:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=org["ai_api_key"])
    prompt = f"""You are a threat intelligence analyst for a {org['size']}-person {org['sector']} company.
Tech stack: {', '.join(org['stack'])}

Triage this security signal and respond with JSON only — no preamble, no markdown fences:

Signal:
  Title: {_strip_html(signal_data.get('title', ''))}
  Description: {_strip_html(signal_data.get('description', ''))[:500]}
  Source: {signal_data.get('source', '')}
  CVE: {signal_data.get('cve_id') or 'N/A'}
  Affected vendors: {', '.join(signal_data.get('affected_vendors') or [])}

Response format:
{{
  "severity": "FLASH|PRIORITY|ROUTINE",
  "summary": "1-2 sentence plain-English summary of the risk to our specific org",
  "confidence": 0.0-1.0,
  "stack_match": true|false
}}"""
    model = org.get("ai_model") or "claude-sonnet-4-20250514"
    msg = await client.messages.create(
        model=model,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    result = json.loads(msg.content[0].text)
    return TriageResult(
        severity=result["severity"],
        summary=result["summary"],
        confidence=result["confidence"],
        method="ai_claude",
        stack_match=result["stack_match"],
    )


async def triage_openai(signal_data: dict, org: dict) -> TriageResult:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=org["ai_api_key"])
    prompt = f"""You are a threat intelligence analyst for a {org['size']}-person {org['sector']} company.
Tech stack: {', '.join(org['stack'])}

Triage this signal. Respond JSON only:
Title: {_strip_html(signal_data.get('title', ''))}
CVE: {signal_data.get('cve_id') or 'N/A'}
Vendors: {', '.join(signal_data.get('affected_vendors') or [])}

{{"severity":"FLASH|PRIORITY|ROUTINE","summary":"1-2 sentences","confidence":0.0-1.0,"stack_match":true|false}}"""
    model = org.get("ai_model") or "gpt-4o-mini"
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
    )
    result = json.loads(resp.choices[0].message.content)
    return TriageResult(
        severity=result["severity"],
        summary=result["summary"],
        confidence=result["confidence"],
        method="ai_openai",
        stack_match=result["stack_match"],
    )


async def triage(signal_data: dict, db=None) -> TriageResult:
    org = get_org_context(db)
    provider = org.get("ai_provider", "none")
    if provider == "claude" and org.get("ai_api_key"):
        try:
            return await triage_claude(signal_data, org)
        except Exception:
            pass
    elif provider == "openai" and org.get("ai_api_key"):
        try:
            return await triage_openai(signal_data, org)
        except Exception:
            pass
    return triage_rules(signal_data, org)
