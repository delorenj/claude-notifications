#!/usr/bin/env bash

# Build script for Zellij Visual Notifications Plugin
# Usage: ./build.sh [release|debug|install|clean|test]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="wasm32-wasi"
PLUGIN_NAME="zellij_visual_notifications"
INSTALL_DIR="${HOME}/.config/zellij/plugins"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    if ! command -v cargo &> /dev/null; then
        print_error "Rust/Cargo not found. Please install Rust: https://rustup.rs"
        exit 1
    fi

    if ! rustup target list --installed | grep -q "${TARGET}"; then
        print_warning "WASM target not installed. Installing ${TARGET}..."
        rustup target add "${TARGET}"
    fi

    print_success "Prerequisites satisfied"
}

# Build debug version
build_debug() {
    print_info "Building debug version..."
    cd "${SCRIPT_DIR}"
    cargo build --target "${TARGET}"
    print_success "Debug build complete: target/${TARGET}/debug/${PLUGIN_NAME}.wasm"
}

# Build release version
build_release() {
    print_info "Building release version..."
    cd "${SCRIPT_DIR}"
    cargo build --release --target "${TARGET}"

    local wasm_file="target/${TARGET}/release/${PLUGIN_NAME}.wasm"

    # Optimize with wasm-opt if available
    if command -v wasm-opt &> /dev/null; then
        print_info "Optimizing WASM with wasm-opt..."
        wasm-opt -Oz "${wasm_file}" -o "${wasm_file}.opt"
        mv "${wasm_file}.opt" "${wasm_file}"
    else
        print_warning "wasm-opt not found, skipping optimization"
        print_info "Install binaryen for better optimization: https://github.com/WebAssembly/binaryen"
    fi

    # Print size
    local size=$(du -h "${wasm_file}" | cut -f1)
    print_success "Release build complete: ${wasm_file} (${size})"
}

# Install plugin
install_plugin() {
    print_info "Installing plugin to ${INSTALL_DIR}..."

    # Ensure release build exists
    local wasm_file="${SCRIPT_DIR}/target/${TARGET}/release/${PLUGIN_NAME}.wasm"
    if [ ! -f "${wasm_file}" ]; then
        print_warning "Release build not found, building..."
        build_release
    fi

    # Create install directory
    mkdir -p "${INSTALL_DIR}"

    # Copy plugin
    cp "${wasm_file}" "${INSTALL_DIR}/"

    print_success "Plugin installed to ${INSTALL_DIR}/${PLUGIN_NAME}.wasm"
    print_info "Add the following to your Zellij config (~/.config/zellij/config.kdl):"
    echo ""
    echo "plugins {"
    echo "    visual-notifications location=\"file:${INSTALL_DIR}/${PLUGIN_NAME}.wasm\" {"
    echo "        enabled true"
    echo "    }"
    echo "}"
}

# Run tests
run_tests() {
    print_info "Running tests..."
    cd "${SCRIPT_DIR}"
    cargo test
    print_success "All tests passed"
}

# Clean build artifacts
clean() {
    print_info "Cleaning build artifacts..."
    cd "${SCRIPT_DIR}"
    cargo clean
    print_success "Clean complete"
}

# Print help
print_help() {
    echo "Zellij Visual Notifications Plugin Build Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  release   Build release version (default)"
    echo "  debug     Build debug version"
    echo "  install   Build and install plugin"
    echo "  test      Run tests"
    echo "  clean     Clean build artifacts"
    echo "  help      Show this help"
    echo ""
    echo "Examples:"
    echo "  $0              # Build release"
    echo "  $0 install      # Build and install"
    echo "  $0 test         # Run tests"
}

# Main
main() {
    check_prerequisites

    case "${1:-release}" in
        release)
            build_release
            ;;
        debug)
            build_debug
            ;;
        install)
            build_release
            install_plugin
            ;;
        test)
            run_tests
            ;;
        clean)
            clean
            ;;
        help|-h|--help)
            print_help
            ;;
        *)
            print_error "Unknown command: $1"
            print_help
            exit 1
            ;;
    esac
}

main "$@"
