#[cfg(not(windows))]
compile_error!("codex-windows-oai-update-checker only supports Windows.");

#[cfg(windows)]
mod addon {
    use std::ffi::{c_char, c_void, CString};
    use std::ptr::{null, null_mut};
    use std::sync::OnceLock;

    type NapiEnv = *mut c_void;
    type NapiValue = *mut c_void;
    type NapiCallbackInfo = *mut c_void;
    type NapiStatus = i32;

    const NAPI_OK: NapiStatus = 0;
    const ERROR_INSUFFICIENT_BUFFER: i32 = 122;
    const APPMODEL_ERROR_NO_PACKAGE: i32 = 15700;
    const OFFICIAL_PACKAGE_FAMILY_NAME: &str = "OpenAI.Codex_2p2nqsd0c76g0";

    #[link(name = "kernel32")]
    extern "system" {
        fn GetModuleHandleW(module_name: *const u16) -> *mut c_void;
        fn GetProcAddress(module: *mut c_void, proc_name: *const c_char) -> *mut c_void;
        fn GetCurrentPackageFamilyName(
            package_family_name_length: *mut u32,
            package_family_name: *mut u16,
        ) -> i32;
    }

    type NapiCreateFunction = unsafe extern "C" fn(
        NapiEnv,
        *const c_char,
        usize,
        Option<unsafe extern "C" fn(NapiEnv, NapiCallbackInfo) -> NapiValue>,
        *mut c_void,
        *mut NapiValue,
    ) -> NapiStatus;
    type NapiSetNamedProperty =
        unsafe extern "C" fn(NapiEnv, NapiValue, *const c_char, NapiValue) -> NapiStatus;
    type NapiCreateObject = unsafe extern "C" fn(NapiEnv, *mut NapiValue) -> NapiStatus;
    type NapiCreateStringUtf8 =
        unsafe extern "C" fn(NapiEnv, *const c_char, usize, *mut NapiValue) -> NapiStatus;
    type NapiGetBoolean = unsafe extern "C" fn(NapiEnv, bool, *mut NapiValue) -> NapiStatus;
    type NapiThrowError = unsafe extern "C" fn(NapiEnv, *const c_char, *const c_char) -> NapiStatus;

    struct Api {
        create_function: NapiCreateFunction,
        set_named_property: NapiSetNamedProperty,
        create_object: NapiCreateObject,
        create_string_utf8: NapiCreateStringUtf8,
        get_boolean: NapiGetBoolean,
        throw_error: NapiThrowError,
    }

    static API: OnceLock<Api> = OnceLock::new();

    #[no_mangle]
    pub unsafe extern "C" fn napi_register_module_v1(
        env: NapiEnv,
        exports: NapiValue,
    ) -> NapiValue {
        if load_api().is_err() {
            return exports;
        }
        define_function(
            env,
            exports,
            "getCurrentPackageFamily",
            get_current_package_family,
        );
        define_function(
            env,
            exports,
            "trySilentDownloadStoreUpdates",
            try_silent_download_store_updates,
        );
        define_function(
            env,
            exports,
            "trySilentDownloadAndInstallStoreUpdates",
            try_silent_download_and_install_store_updates,
        );
        exports
    }

    unsafe extern "C" fn get_current_package_family(
        env: NapiEnv,
        _info: NapiCallbackInfo,
    ) -> NapiValue {
        match current_package_family_name() {
            Ok(value) => create_string(env, &value),
            Err(message) => throw_error(env, &message),
        }
    }

    unsafe extern "C" fn try_silent_download_store_updates(
        env: NapiEnv,
        _info: NapiCallbackInfo,
    ) -> NapiValue {
        create_update_result(env, true)
    }

    unsafe extern "C" fn try_silent_download_and_install_store_updates(
        env: NapiEnv,
        _info: NapiCallbackInfo,
    ) -> NapiValue {
        create_update_result(env, true)
    }

    unsafe fn define_function(
        env: NapiEnv,
        exports: NapiValue,
        name: &str,
        callback: unsafe extern "C" fn(NapiEnv, NapiCallbackInfo) -> NapiValue,
    ) {
        let Ok(api) = load_api() else {
            return;
        };
        let Ok(name_cstring) = CString::new(name) else {
            return;
        };
        let mut function = null_mut();
        if (api.create_function)(
            env,
            name_cstring.as_ptr(),
            name.len(),
            Some(callback),
            null_mut(),
            &mut function,
        ) != NAPI_OK
        {
            return;
        }
        (api.set_named_property)(env, exports, name_cstring.as_ptr(), function);
    }

    unsafe fn create_update_result(env: NapiEnv, has_update: bool) -> NapiValue {
        let Ok(api) = load_api() else {
            return null_mut();
        };
        let mut result = null_mut();
        if (api.create_object)(env, &mut result) != NAPI_OK {
            return null_mut();
        }

        set_bool(env, result, "hasUpdate", has_update);
        set_bool(env, result, "canSilentlyDownload", has_update);
        set_bool(env, result, "completed", has_update);
        set_string(
            env,
            result,
            "overallState",
            if has_update { "Completed" } else { "NoUpdate" },
        );

        result
    }

    unsafe fn set_bool(env: NapiEnv, object: NapiValue, name: &str, value: bool) {
        let Ok(api) = load_api() else {
            return;
        };
        let Ok(name_cstring) = CString::new(name) else {
            return;
        };
        let mut js_value = null_mut();
        if (api.get_boolean)(env, value, &mut js_value) == NAPI_OK {
            (api.set_named_property)(env, object, name_cstring.as_ptr(), js_value);
        }
    }

    unsafe fn set_string(env: NapiEnv, object: NapiValue, name: &str, value: &str) {
        let Ok(api) = load_api() else {
            return;
        };
        let Ok(name_cstring) = CString::new(name) else {
            return;
        };
        let js_value = create_string(env, value);
        if !js_value.is_null() {
            (api.set_named_property)(env, object, name_cstring.as_ptr(), js_value);
        }
    }

    unsafe fn create_string(env: NapiEnv, value: &str) -> NapiValue {
        let Ok(api) = load_api() else {
            return null_mut();
        };
        let Ok(value_cstring) = CString::new(value) else {
            return throw_error(env, "String value contains an embedded null byte.");
        };
        let mut result = null_mut();
        if (api.create_string_utf8)(env, value_cstring.as_ptr(), value.len(), &mut result)
            != NAPI_OK
        {
            return null_mut();
        }
        result
    }

    unsafe fn throw_error(env: NapiEnv, message: &str) -> NapiValue {
        let Ok(api) = load_api() else {
            return null_mut();
        };
        let Ok(message_cstring) = CString::new(message) else {
            return null_mut();
        };
        (api.throw_error)(env, null(), message_cstring.as_ptr());
        null_mut()
    }

    unsafe fn load_api() -> Result<&'static Api, String> {
        if let Some(api) = API.get() {
            return Ok(api);
        }

        let module = GetModuleHandleW(null());
        if module.is_null() {
            return Err("GetModuleHandleW failed for the current process.".into());
        }

        let api = Api {
            create_function: std::mem::transmute(load_proc(module, "napi_create_function")?),
            set_named_property: std::mem::transmute(load_proc(module, "napi_set_named_property")?),
            create_object: std::mem::transmute(load_proc(module, "napi_create_object")?),
            create_string_utf8: std::mem::transmute(load_proc(module, "napi_create_string_utf8")?),
            get_boolean: std::mem::transmute(load_proc(module, "napi_get_boolean")?),
            throw_error: std::mem::transmute(load_proc(module, "napi_throw_error")?),
        };

        let _ = API.set(api);
        API.get()
            .ok_or_else(|| "Failed to initialize N-API function table.".to_string())
    }

    unsafe fn load_proc(module: *mut c_void, name: &str) -> Result<*mut c_void, String> {
        let c_name = CString::new(name).map_err(|_| format!("Invalid N-API symbol '{name}'."))?;
        let value = GetProcAddress(module, c_name.as_ptr());
        if value.is_null() {
            Err(format!("Host process does not export {name}."))
        } else {
            Ok(value)
        }
    }

    fn current_package_family_name() -> Result<String, String> {
        let mut length = 0_u32;
        let first = unsafe { GetCurrentPackageFamilyName(&mut length, null_mut()) };
        if first == APPMODEL_ERROR_NO_PACKAGE {
            // ZIP builds have no AppModel package family. Return an empty
            // value so the recovered updater stays disabled outside MSIX/AppX.
            return Ok(String::new());
        }
        if first != ERROR_INSUFFICIENT_BUFFER || length == 0 {
            return Err(format!(
                "GetCurrentPackageFamilyName failed with code {first}."
            ));
        }

        let mut buffer = vec![0_u16; length as usize];
        let second = unsafe { GetCurrentPackageFamilyName(&mut length, buffer.as_mut_ptr()) };
        if second != 0 {
            return Err(format!(
                "GetCurrentPackageFamilyName failed with code {second}."
            ));
        }

        if length > 0 && buffer[(length - 1) as usize] == 0 {
            buffer.truncate((length - 1) as usize);
        } else {
            buffer.truncate(length as usize);
        }

        let package_family_name = String::from_utf16(&buffer)
            .map_err(|_| "Current package family name is not valid UTF-16.".to_string())?;

        if package_family_name != OFFICIAL_PACKAGE_FAMILY_NAME {
            return Ok(String::new());
        }

        Ok(package_family_name)
    }
}
