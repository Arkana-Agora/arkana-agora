# Operational Overrides

Project-level policy overrides for workflow and operational commands.

## Precedence order

1. User explicit instruction in the current chat.
2. This project override file.
3. Plugin default policy.

## Policy overrides

```yaml
# Example: AWS operations
aws:
  sso_login_before_commands: true
  default_profile: "<project-aws-profile>"

# Example: Lambda deployment
lambda:
  deploy_method: "project-deploy-scripts-only"   # never IAC/CDK

# Example: validation
validation:
  command: "npm run validate"
  run_before_commit: true
```

## Omitted policy = default behavior

Any policy not listed above falls back to the plugin defaults (see `.opencode/AGENTS.md`). Keep this file minimal: only document overrides that intentionally differ from defaults.