extends SceneTree
## Test runner: godot --headless --path game --script res://tests/run.gd
## Finds every res://tests/test_*.gd, instantiates it and calls each method named test_*(t: TestContext).
## A test fails with t.fail("msg"). Exit code 0 when all pass, 1 otherwise (including a script that
## fails to load, parse or instantiate).

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
		var suite: Object = script.new()
		for m in script.get_script_method_list():
			var method_name: String = m["name"]
			if not method_name.begins_with("test_"):
				continue
			var t := TestContext.new()
			suite.call(method_name, t)
			if t.failures.is_empty():
				print("PASS %s::%s" % [file, method_name])
				passed += 1
			else:
				failed += 1
				for msg in t.failures:
					printerr("FAIL %s::%s: %s" % [file, method_name, msg])
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
