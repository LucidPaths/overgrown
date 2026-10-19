class_name TestContext
extends RefCounted
## Passed to every test method. GDScript has no exceptions, so a test fails by calling fail().

var failures: Array[String] = []


func fail(msg: String) -> void:
	failures.append(msg)


func check(cond: bool, msg: String) -> void:
	if not cond:
		fail(msg)
