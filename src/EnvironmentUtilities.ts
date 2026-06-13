// -----------------------------------------------------------------------------------
// Copyright 2026, Gilles Zunino
// -----------------------------------------------------------------------------------

import os from "os";

export const isWindowsOperatingSystem: boolean = os.platform() === "win32";
