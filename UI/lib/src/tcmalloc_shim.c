/*
 * tcmalloc_shim.c — LD_PRELOAD shim for Electron 5 + Boost.Asio compatibility
 *
 * PROBLEM: Electron 5 statically links Google's tcmalloc, which overrides the
 * standard malloc/free/new/delete. When Boost.Asio allocates memory via
 * std::aligned_alloc() (glibc) or posix_memalign() (glibc), the resulting
 * pointers have alignment prefix bytes that tcmalloc's free() doesn't
 * recognize. This causes: "tcmalloc: Attempt to free invalid pointer 0x7XXX0000880"
 * followed by a segfault. The 0x0880 offset is characteristic of aligned_alloc's
 * alignment prefix.
 *
 * FIX: This shim redirects aligned_alloc() and posix_memalign() through
 * memalign(), which tcmalloc DOES handle correctly (it routes through its
 * own internal allocator). This ensures all allocations go through tcmalloc's
 * pool, so free() can always find and release them.
 *
 * USAGE (required for Electron, optional for standalone Node):
 *   LD_PRELOAD=/path/to/tcmalloc_shim.so electron --no-sandbox .
 *
 * BUILD:
 *   gcc -shared -fPIC -o tcmalloc_shim.so src/tcmalloc_shim.c -ldl
 *
 * See also: -DBOOST_ASIO_HAS_STD_ALIGNED_ALLOC=0 and
 *           -DBOOST_ASIO_HAS_BOOST_ALIGN=0 in CMakeLists.txt, which
 *           force Boost.Asio to use ::operator new/delete instead of
 *           std::aligned_alloc/free (helps for standalone Node runs).
 */

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