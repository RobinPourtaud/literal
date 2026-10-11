.org 0
CLS
LDI R1, 3
LDI R2, 3
LDI R3, 16
LDI R4, 16
row:
MOV R0, R3
pixel:
PIXEL R0, R1, R2
CMP R0, R4
JZ next_row
ADDI R0, 1
JMP pixel
next_row:
ADDI R1, 1
CMPI R1, 17
JZ done
SUBI R3, 1
ADDI R4, 1
JMP row
done:
HALT
