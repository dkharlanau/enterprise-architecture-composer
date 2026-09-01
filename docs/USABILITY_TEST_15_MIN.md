# 15-minute external usability test

This kit tests whether a new user can produce and challenge one architecture proposal. It records usability evidence; it does not validate the user's architecture or claim external adoption.

## Participant and safety boundary

Suitable participant: an enterprise architect, solution architect, system analyst, or senior integration/data practitioner who has not used Composer before.

Use only the included synthetic context. Do not paste client names, system identifiers, internal URLs, credentials, or proprietary architecture exports into a public issue.

## Facilitator script

| Time | Participant task | Observe without coaching |
| --- | --- | --- |
| 0–2 min | Read the first README screen and state what the product does and does not do. | Incorrect product expectations or unclear terms. |
| 2–6 min | Run the [golden quickstart](GOLDEN_QUICKSTART.md) through composition. | Setup friction, command mistakes, time to first output. |
| 6–10 min | Open the review report and identify one recommendation, one finding, and one unresolved human decision. | Whether provenance and boundaries are discoverable. |
| 10–13 min | Change one synthetic constraint and rerun composition or comparison. | Whether the user predicts and understands the change. |
| 13–15 min | Explain what they would trust, challenge, or hand off next. | Confusion between proposal, approval, and downstream execution. |

Stop if setup consumes more than six minutes. Record the blocker rather than finishing the task for the participant.

## Blank result record

```text
Release/tag tested:
Operating system and Node version:
Participant role (no employer/client name):
Completed within 15 minutes: yes / no
First blocking step:
One recommendation correctly identified: yes / no
One unresolved decision correctly identified: yes / no
Proposal vs approval boundary understood: yes / no / unclear
Most useful part:
Most confusing part:
Suggested documentation or product change:
```

Submit privacy-safe results through the [external usability feedback form](https://github.com/dkharlanau/enterprise-architecture-composer/issues/new?template=usability-feedback.yml). Empty templates and planned sessions are not counted as tester results.
