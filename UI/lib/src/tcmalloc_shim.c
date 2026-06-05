#define _GNU_SOURCE
#include <stdlib.h>
#include <malloc.h>
#include <errno.h>

void* aligned_alloc(size_t alignment, size_t size) {
    return memalign(alignment, size);
}

int posix_memalign(void** memptr, size_t alignment, size_t size) {
    void* ptr = memalign(alignment, size);
    if (!ptr) return ENOMEM;
    *memptr = ptr;
    return 0;
}
