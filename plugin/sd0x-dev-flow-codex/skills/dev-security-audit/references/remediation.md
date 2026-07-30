# Remediation Handoff by Category

This read-only reference maps exposure classes to a separate remediation owner. It does not authenticate, revoke, rotate, delete, copy, publish, or change any local or external resource.

| Exposure class | Handoff destination | Evidence to preserve |
|---|---|---|
| Cloud credentials | Provider security console and incident-response owner | Account, key fingerprint, last-used time, audit-log window |
| SSH or GPG keys | Host owners and signing-key administrator | Public fingerprint, affected hosts, signing history |
| Git platform tokens | Platform security settings and repository administrators | Token type, application name, security-log window |
| Package registries | Registry security settings and package owners | Token fingerprint, package scope, publish history |
| Database or SaaS secrets | Service owner and secrets manager | Secret class, environment, access-log window |
| Wallet material | Wallet vendor recovery procedure and asset owner | Wallet type, public address, exposure timestamp |
| VPN or environment files | Network or application owner | File class, environment, affected service list |

Return the ordered handoff list, urgency, affected scope, and audit-log windows. The remediation workflow must independently establish its target, recovery plan, and verification.
