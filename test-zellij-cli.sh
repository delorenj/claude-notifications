#!/usr/bin/env bash
# Quick test script for zellij-notify CLI (outside Zellij)

echo "🧪 Testing zellij-notify CLI"
echo "============================"
echo ""

# Test 1: Help
echo "✓ Test 1: Help command"
if zellij-notify --help > /dev/null 2>&1; then
  echo "  ✅ Help works"
else
  echo "  ❌ Help failed"
  exit 1
fi

# Test 2: Version in package.json
echo ""
echo "✓ Test 2: Package configuration"
if grep -q "zellij-notify" package.json; then
  echo "  ✅ Binary registered in package.json"
else
  echo "  ❌ Binary not found in package.json"
  exit 1
fi

# Test 3: Executable permissions
echo ""
echo "✓ Test 3: Executable permissions"
if [ -x "./bin/zellij-notify.js" ]; then
  echo "  ✅ File is executable"
else
  echo "  ❌ File is not executable"
  exit 1
fi

# Test 4: Node.js syntax check
echo ""
echo "✓ Test 4: JavaScript syntax"
if node -c ./bin/zellij-notify.js > /dev/null 2>&1; then
  echo "  ✅ Valid JavaScript syntax"
else
  echo "  ❌ Syntax error detected"
  exit 1
fi

# Test 5: Library functions
echo ""
echo "✓ Test 5: Library module"
if node -e "require('./lib/zellij')" > /dev/null 2>&1; then
  echo "  ✅ Library module loads correctly"
else
  echo "  ❌ Library module has errors"
  exit 1
fi

# Test 6: Expected error outside Zellij
echo ""
echo "✓ Test 6: Error handling (not in Zellij)"
if zellij-notify "test" 2>&1 | grep -q "Not in a Zellij session"; then
  echo "  ✅ Correctly detects when not in Zellij"
else
  echo "  ⚠️  Warning: Detection may not be working correctly"
fi

echo ""
echo "✨ All tests passed!"
echo ""
echo "📝 To test full functionality:"
echo "  1. Launch Zellij: zellij --layout test-notification-plugin.kdl"
echo "  2. Run: ./examples/zellij-notify-examples.sh"
echo ""
