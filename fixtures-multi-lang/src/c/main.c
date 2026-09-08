// fixtures-multi-lang/src/c/main.c
#include <stdio.h>
#include <stdlib.h>
#include "my.h"

int main(int argc, char *argv[]) {
    printf("hi\n");
    return 0;
}

int helper(int x) {
    return x + 1;
}
