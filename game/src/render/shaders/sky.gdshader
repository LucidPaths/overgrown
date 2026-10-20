shader_type sky;
// The overgrown sky (ART-027): see og_sky.gdshaderinc. The radiance pass gets the cheap version.

#include "res://src/render/shaders/og_common.gdshaderinc"
#include "res://src/render/shaders/og_sky.gdshaderinc"

void sky() {
	if (AT_CUBEMAP_PASS) {
		COLOR = og_sky(EYEDIR, TIME, 0);
	} else {
		COLOR = og_sky(EYEDIR, TIME, 1);
	}
}
