import { bootProgram } from "./computer.ts";

export const snakeGame = bootProgram(
  `.org 0x0200
; RAM: length 2000, score 2001, state 2004; body X/Y at 2100/2200.
game:
LDI R0, 16
LDI R1, 12
LDI R2, 131
LDI R5, 17
LDI R6, 12
LDI R7, 3
ST R7, 0x2000
LDI R3, 0
ST R3, 0x2001
ST R3, 0x2004
ST R0, 0x2100
ST R1, 0x2200
LDI R3, 15
ST R3, 0x2101
LDI R3, 14
ST R3, 0x2102
ST R1, 0x2201
ST R1, 0x2202
CALL render
release_key:
LD R3, 0xFF01
CMPI R3, 0
JNZ release_key
wait_key:
LD R3, 0xFF01
CMPI R3, 0
JZ wait_key
LD R3, 0xFF00
CMPI R3, 128
JZ try_up
CMPI R3, 129
JZ try_down
CMPI R3, 130
JZ try_left
CMPI R3, 131
JZ try_right
JMP release_key
try_up:
CMPI R2, 129
JZ release_key
MOV R2, R3
SUBI R1, 1
JMP moved
try_down:
CMPI R2, 128
JZ release_key
MOV R2, R3
ADDI R1, 1
JMP moved
try_left:
CMPI R2, 131
JZ release_key
MOV R2, R3
SUBI R0, 1
JMP moved
try_right:
CMPI R2, 130
JZ release_key
MOV R2, R3
ADDI R0, 1
moved:
CMPI R0, 0
JZ lost
CMPI R0, 31
JZ lost
CMPI R1, 0
JZ lost
CMPI R1, 23
JZ lost
MOV R3, R7
SUBI R3, 1
ST R3, 0x2003
LDI R3, 0
ST R3, 0x2005
CMP R0, R5
JNZ collision
CMP R1, R6
JNZ collision
ST R7, 0x2003
LDI R3, 1
ST R3, 0x2005
collision:
LDI R4, 0
collision_next:
LD R3, 0x2003
CMP R4, R3
JZ shift_start
LDX R3, 0x2100, R4
CMP R0, R3
JNZ collision_skip
LDX R3, 0x2200, R4
CMP R1, R3
JZ lost
collision_skip:
ADDI R4, 1
JMP collision_next
shift_start:
PUSH R0
PUSH R1
PUSH R2
LDI R4, 0
LDX R0, 0x2100, R4
LDX R1, 0x2200, R4
LDI R2, 3
PIXEL R0, R1, R2
LD R3, 0x2005
CMPI R3, 0
JNZ retain_tail
MOV R4, R7
SUBI R4, 1
LDX R0, 0x2100, R4
LDX R1, 0x2200, R4
LDI R2, 0
PIXEL R0, R1, R2
retain_tail:
POP R2
POP R1
POP R0
LD R3, 0x2005
CMPI R3, 0
JZ shift_body
ADDI R7, 1
ST R7, 0x2000
LD R3, 0x2001
ADDI R3, 1
ST R3, 0x2001
shift_body:
MOV R4, R7
SUBI R4, 1
shift_next:
SUBI R4, 1
LDX R3, 0x2100, R4
ADDI R4, 1
STX R3, 0x2100, R4
SUBI R4, 1
LDX R3, 0x2200, R4
ADDI R4, 1
STX R3, 0x2200, R4
SUBI R4, 1
JNZ shift_next
ST R0, 0x2100
ST R1, 0x2200
CMPI R7, 128
JZ won
LD R3, 0x2005
CMPI R3, 0
JZ draw_game
food_candidate:
ADDI R5, 7
CMPI R5, 31
JC food_y
SUBI R5, 30
food_y:
ADDI R6, 5
CMPI R6, 23
JC food_scan
SUBI R6, 22
food_scan:
LDI R4, 0
food_next:
LDX R3, 0x2100, R4
CMP R5, R3
JNZ food_skip
LDX R3, 0x2200, R4
CMP R6, R3
JZ food_candidate
food_skip:
ADDI R4, 1
CMP R4, R7
JNZ food_next
draw_game:
LDI R3, 2
PIXEL R5, R6, R3
LDI R3, 7
PIXEL R0, R1, R3
JMP release_key
lost:
LDI R3, 1
ST R3, 0x2004
CALL lost_print
JMP finished
won:
LDI R3, 2
ST R3, 0x2004
CALL render
CALL won_print
finished:
LD R3, 0xFF01
CMPI R3, 0
JNZ finished
restart_wait:
LD R3, 0xFF01
CMPI R3, 0
JZ restart_wait
LD R3, 0xFF00
CMPI R3, 82
JZ game
JMP finished
render:
PUSH R0
PUSH R1
PUSH R2
CLS
LDI R2, 4
LDI R0, 0
border_horizontal:
LDI R1, 0
PIXEL R0, R1, R2
LDI R1, 23
PIXEL R0, R1, R2
ADDI R0, 1
CMPI R0, 32
JNZ border_horizontal
LDI R1, 1
border_vertical:
LDI R0, 0
PIXEL R0, R1, R2
LDI R0, 31
PIXEL R0, R1, R2
ADDI R1, 1
CMPI R1, 23
JNZ border_vertical
LDI R4, 0
LDI R2, 3
body_next:
LDX R0, 0x2100, R4
LDX R1, 0x2200, R4
PIXEL R0, R1, R2
ADDI R4, 1
CMP R4, R7
JNZ body_next
LDI R2, 2
PIXEL R5, R6, R2
POP R2
POP R1
POP R0
LDI R3, 7
PIXEL R0, R1, R3
RET
.org 0x0C00
lost_print:
LDI R4, 0
lost_next:
LDX R3, lost_text, R4
CMPI R3, 0
JZ message_return
ST R3, 0xFF03
ADDI R4, 1
JMP lost_next
won_print:
LDI R4, 0
won_next:
LDX R3, won_text, R4
CMPI R3, 0
JZ message_return
ST R3, 0xFF03
ADDI R4, 1
JMP won_next
message_return:
RET
lost_text:
.byte ${
    [..."Game over. Press R to restart.\n"].map((c) => c.charCodeAt(0)).concat(
      0,
    ).join(", ")
  }
won_text:
.byte ${
    [..."128 segments! You win. Press R to restart.\n"].map((c) =>
      c.charCodeAt(0)
    ).concat(0).join(", ")
  }
`,
  "SNAKE",
  "Arrows: one step per press | Green: food | R: restart after game over",
);
