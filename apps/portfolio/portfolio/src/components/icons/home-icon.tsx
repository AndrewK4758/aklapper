import type { SxProps } from '@mui/material/styles';
import SvgIcon from '@mui/material/SvgIcon';

interface HomeIconProps {
  sx: SxProps;
}

const HomeIcon = ({ sx }: HomeIconProps) => (
  <SvgIcon sx={sx}>
    <svg
      version="1.1"
      id="svg55"
      width="512"
      height="512"
      viewBox="0 0 512 512"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      xmlns="http://www.w3.org/2000/svg"
      xmlns-svg="http://www.w3.org/2000/svg"
    >
      <defs id="defs59" />
      <g id="g61">
        <image
          width="512"
          height="512"
          preserveAspectRatio="none"
          xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAAxHpUWHRSYXcgcHJvZmlsZSB0eXBl
IGV4aWYAAHjabVBRDsMgCP3nFDuCAqV4HNu6ZDfY8YeCS9v0JT7wYR4gtO/nDa8OzAy8rCpFJBm4
cMFqiSZHHZwTD57AUC86/AtoElkkL6h4zFOfRhFztWw5Gekehe1aKBzt9WYUjahP1Ec4wqiEEaEX
chhUXytJ0fW8wtbSFeoHOu3N18vR7X7n1X7vWEwkxEYmGxOJD0D9MFC1pBgjiT20kYdCxjyeZv+Q
p3+agB889FnULD7xMQAAAYRpQ0NQSUNDIHByb2ZpbGUAAHicfZE9SMNAHMVfW0tVKg4WlOKQoTrZ
RUUcaxWKUCHUCq06mFz6BU0akhQXR8G14ODHYtXBxVlXB1dBEPwAcXZwUnSREv+XFFrEeHDcj3f3
HnfvAH+zylSzJwGommVkUkkhl18VQq/oQxRBBDAsMVOfE8U0PMfXPXx8vYvzLO9zf44BpWAywCcQ
J5huWMQbxDObls55nzjCypJCfE48YdAFiR+5Lrv8xrnksJ9nRoxsZp44QiyUuljuYlY2VOJp4pii
apTvz7mscN7irFbrrH1P/sJwQVtZ5jrNUaSwiCWIECCjjgqqsBCnVSPFRIb2kx7+qOMXySWTqwJG
jgXUoEJy/OB/8Ltbszg16SaFk0DwxbY/xoDQLtBq2Pb3sW23ToDAM3Cldfy1JjD7SXqjo8WOgMFt
4OK6o8l7wOUOMPKkS4bkSAGa/mIReD+jb8oDQ7dA/5rbW3sfpw9AlrpK3wAHh8B4ibLXPd7d293b
v2fa/f0AQuNykyqG0qIAAA5baVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVn
aW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5z
Ong9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA0LjQuMC1FeGl2MiI+CiA8cmRm
OlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1u
cyMiPgogIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICB4bWxuczp4bXBNTT0iaHR0
cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIKICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMu
YWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiCiAgICB4bWxuczpkYz0iaHR0
cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICB4bWxuczpHSU1QPSJodHRwOi8vd3d3
LmdpbXAub3JnL3htcC8iCiAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYv
MS4wLyIKICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgeG1w
TU06RG9jdW1lbnRJRD0iZ2ltcDpkb2NpZDpnaW1wOmU5NjU2MDI5LWUwYzEtNDZmNS1hYmZlLWNh
YTBkNGQ5ODVmNyIKICAgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo3Y2Q2NzJjMi01ZTg1LTQ5
NTktYjk5Yi05ZGQyMjcwZDgzOWQiCiAgIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRp
ZDo5OGIyNDUyOS1lMDhlLTRmMGItYmU3Yy1hMTAxMTdjMjdmYzgiCiAgIGRjOkZvcm1hdD0iaW1h
Z2UvcG5nIgogICBHSU1QOkFQST0iMi4wIgogICBHSU1QOlBsYXRmb3JtPSJMaW51eCIKICAgR0lN
UDpUaW1lU3RhbXA9IjE3MjczMjcwMzA5Nzc0NjAiCiAgIEdJTVA6VmVyc2lvbj0iMi4xMC4zNiIK
ICAgdGlmZjpPcmllbnRhdGlvbj0iMSIKICAgeG1wOkNyZWF0b3JUb29sPSJHSU1QIDIuMTAiCiAg
IHhtcDpNZXRhZGF0YURhdGU9IjIwMjQ6MDk6MjZUMDE6MDM6NDYtMDQ6MDAiCiAgIHhtcDpNb2Rp
ZnlEYXRlPSIyMDI0OjA5OjI2VDAxOjAzOjQ2LTA0OjAwIj4KICAgPHhtcE1NOkhpc3Rvcnk+CiAg
ICA8cmRmOlNlcT4KICAgICA8cmRmOmxpCiAgICAgIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiCiAgICAg
IHN0RXZ0OmNoYW5nZWQ9Ii8iCiAgICAgIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6MmIwZGU5
M2UtMmZhYi00MjI4LTgxMWItNzlmYTM3MmZmZTAwIgogICAgICBzdEV2dDpzb2Z0d2FyZUFnZW50
PSJHaW1wIDIuMTAgKExpbnV4KSIKICAgICAgc3RFdnQ6d2hlbj0iMjAyNC0wOS0yNVQxNzo1MDoz
MS0wNDowMCIvPgogICAgIDxyZGY6bGkKICAgICAgc3RFdnQ6YWN0aW9uPSJzYXZlZCIKICAgICAg
c3RFdnQ6Y2hhbmdlZD0iLyIKICAgICAgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo1MTNlOTZm
MS1iNWNhLTQyZjYtOGYwNi00ZWVjNzg1MThjMTAiCiAgICAgIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9
IkdpbXAgMi4xMCAoTGludXgpIgogICAgICBzdEV2dDp3aGVuPSIyMDI0LTA5LTI2VDAxOjAzOjUw
LTA0OjAwIi8+CiAgICA8L3JkZjpTZXE+CiAgIDwveG1wTU06SGlzdG9yeT4KICA8L3JkZjpEZXNj
cmlwdGlvbj4KIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAK
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
IAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0idyI/PrS5cr0AAAAG
YktHRAD/AP8A/6C9p5MAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAHdElNRQfoCRoFAzLhRiZtAAAL
TElEQVR42u3dS25byxmF0SrDoyLY4cjZIc60qBYNQSYIiudRj71WK0FyJUQB8n+7aOXWwmqn8+Xu
pwBwnOV2rX4K6/gBOvQAwkAA4OADCAIB4OgDIAgEgIMPgBgQAA4/AEJAADj6AIgBAeDwAyAEBICj
D4AYEAAOPwBCQAA4/AAIAQHg8AMgAgSA4w+AEBAADj8AQiApABx+AIRAWAA4/gCIgKAAcPgBEAJh
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
TkSuQmCC
"
          id="image63"
        />
      </g>
    </svg>
  </SvgIcon>
);

export default HomeIcon;