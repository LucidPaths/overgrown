extends SceneTree
## Test runner: godot --headless --path game --script res://tests/run.gd
## Finds every res://tests/test_*.gd, instantiates it and calls each method named test_*(t: TestContext).
## A test fails with t.fail("msg"). Exit code 0 when all pass, 1 otherwise (including a script that
## fails to load, parse or instantiate).
## Runtime script errors don't stop Godot and don't change this exit code, and a hang can't be caught from inside:
## tools/godot/test.sh scans the output for errors and enforces a timeout.

const TESTS_DIR := "res://tests"


func _init() -> void:
	var passed := 0
	var failed := 0
	for file in _test_files():
		var script := ResourceLoader.load("%s/%s" % [TESTS_DIR, file], "GDScript", ResourceLoader.CACHE_MODE_IGNORE) as GDScript
		if script == null or not script.can_instantiate():
			printerr("FAIL %s (script does not load or parse)" % file)
			failed += 1
			continue
		# An invalid call in this frame aborts _init before quit() and hangs Godot, so check what can be
		# checked (arity) up front and report it as a FAIL instead of calling.
		var method_list := script.get_script_method_list()
		var init_args := method_list.filter(func(m: Dictionary) -> bool: return m["name"] == "_init" and m["args"].size() > 0)
		if not init_args.is_empty():
			printerr("FAIL %s (_init must take no arguments)" % file)
			failed += 1
			continue
		var suite: Object = script.new()
		if suite == null:
			printerr("FAIL %s (instantiation failed)" % file)
			failed += 1
			continue
		var methods := 0
		for m in method_list:
			var method_name: String = m["name"]
			if not method_name.begins_with("test_"):
				continue
			methods += 1
			if m["args"].size() != 1:
				printerr("FAIL %s::%s (test methods take one TestContext argument)" % [file, method_name])
				failed += 1
				continue
			var t := TestContext.new()
			var r: Variant = suite.call(method_name, t)
			if r != null:
				printerr("FAIL %s::%s (test methods must not await or return a value: the runner quits before a coroutine resumes)" % [file, method_name])
				failed += 1
				continue
			if t.failures.is_empty():
				print("PASS %s::%s" % [file, method_name])
				passed += 1
			else:
				failed += 1
				for msg in t.failures:
					printerr("FAIL %s::%s: %s" % [file, method_name, msg])
		if methods == 0:
			printerr("FAIL %s (no test_* methods)" % file)
			failed += 1
		if not suite is RefCounted:
			suite.free()
	print("%d passed, %d failed" % [passed, failed])
	quit(1 if failed > 0 or passed == 0 else 0)


func _test_files() -> Array[String]:
	var files: Array[String] = []
	for f in DirAccess.get_files_at(TESTS_DIR):
		if f.begins_with("test_") and f.ends_with(".gd"):
			files.append(f)
	files.sort()
	return files
