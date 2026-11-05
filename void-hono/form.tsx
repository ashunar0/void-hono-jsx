// Forms and actions: Form, useForm, useIslandForm and action().
// Same API and behavior as the Vue, Svelte and Solid adapters: submit methods return a promise.
import { useContext, useEffect, useMemo, useRef, useState } from 'hono/jsx'
import type { Child, JSX, PropsWithChildren } from 'hono/jsx'
import {
  cloneFormValue,
  createActionClient,
  formErrorMessage,
  formRetryMessage,
  formSubmissionBlocked,
  getValidationErrors,
  interpolateRouteParams,
  isAbortError,
  isEqualFormValue,
  parseFormResetArgs,
  scheduleFormRetry,
  submitAction,
  submitIslandAction,
  type ActionClient,
  type FormMethod,
  type FormModel,
  type FormResetOptions,
  type FormState,
  type FormSubmitOptions,
  type IslandFormState,
  type VoidActionError,
} from 'void/pages-client'
import type { ActionFormOptions, ActionUrl, ResolveActionBody } from 'void/routes'
import { ErrorsContext, RouterContext } from './context.ts'

const client = createActionClient()
export const action: ActionClient['action'] = client.action
export const setActionRouter: ActionClient['setActionRouter'] = client.setActionRouter

type Fields = Record<string, unknown>
type FieldErrors = Record<string, string>

/** The flags every form hook reports about its last submission. */
function useSubmissionStatus() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<VoidActionError | null>(null)
  const [wasSuccessful, setWasSuccessful] = useState(false)
  const [recentlySuccessful, setRecentlySuccessful] = useState(false)
  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearSuccessTimeout = () => {
    if (successTimeout.current) clearTimeout(successTimeout.current)
    successTimeout.current = null
  }
  useEffect(() => clearSuccessTimeout, [])
  return {
    pending,
    error,
    wasSuccessful,
    recentlySuccessful,
    setError,
    begin() {
      setPending(true)
      setWasSuccessful(false)
      setRecentlySuccessful(false)
      clearSuccessTimeout()
      setError(null)
    },
    succeed() {
      setWasSuccessful(true)
      setRecentlySuccessful(true)
      successTimeout.current = setTimeout(() => setRecentlySuccessful(false), 2000)
    },
    end: () => setPending(false),
  }
}

type FormReturn<TData> = FormState<TData, 'setters'> &
  Readonly<{
    setData: <K extends keyof TData & string>(field: K, value: TData[K]) => void
    post(options?: FormSubmitOptions): Promise<void>
    put(options?: FormSubmitOptions): Promise<void>
    patch(options?: FormSubmitOptions): Promise<void>
    delete(options?: FormSubmitOptions): Promise<void>
  }>

// Typed overload: full inference from the page's action (requires codegen)
export function useForm<U extends ActionUrl & string>(
  url: U,
  defaults: ResolveActionBody<U>,
  options?: ActionFormOptions<U>,
): FormReturn<ResolveActionBody<U>>
export function useForm(
  url: string,
  defaults: Fields,
  options?: { params?: Record<string, string>; resetOnSuccess?: boolean },
): FormReturn<Fields> {
  const router = useContext(RouterContext)
  // Errors the server sent with the page. A new router result replaces local edits.
  const serverErrors = useContext(ErrorsContext)
  const initial = useRef<Fields>(cloneFormValue(defaults))
  const [data, setDataState] = useState<Fields>(() => cloneFormValue(defaults))
  const [currentDefaults, setCurrentDefaults] = useState<Fields>(() => cloneFormValue(defaults))
  const [localErrors, setLocalErrors] = useState<{ source: FieldErrors; values: FieldErrors } | null>(null)
  const status = useSubmissionStatus()

  // Submit and reset read the latest values, not the ones from the render that created them
  const dataRef = useRef(data)
  const defaultsRef = useRef(currentDefaults)
  const errors = localErrors?.source === serverErrors ? localErrors.values : serverErrors
  const errorsRef = useRef(errors)
  errorsRef.current = errors

  const hasChanges = useMemo(
    () => Object.keys(currentDefaults).some((key) => !isEqualFormValue(data[key], currentDefaults[key])),
    [data, currentDefaults],
  )

  const replaceData = (next: Fields) => {
    dataRef.current = next
    setDataState(next)
  }
  const replaceErrors = (values: FieldErrors) => {
    errorsRef.current = values
    setLocalErrors({ source: serverErrors, values })
  }
  const clearErrors = (...fields: ReadonlyArray<string>) => {
    if (fields.length === 0) return replaceErrors({})
    const next = { ...errorsRef.current }
    for (const field of fields) delete next[field]
    replaceErrors(next)
  }

  async function submit(method: string, submitOptions: FormSubmitOptions = {}) {
    status.begin()
    clearErrors()
    try {
      if (!router) throw new Error('useForm(): requires the Void Router.')
      // Params are filled in on submit, so a param that would change the request
      // path (such as "..") fails this submit, not the page render.
      const result = await submitAction(router, interpolateRouteParams(url, options?.params), {
        method,
        data: { ...dataRef.current },
        ...submitOptions,
      })
      if (!result.ok) {
        const validationErrors = getValidationErrors(result.error.body)
        if (validationErrors) replaceErrors(validationErrors)
        else status.setError(result.error)
        return
      }
      if (options?.resetOnSuccess) replaceData(cloneFormValue(initial.current))
      defaultsRef.current = cloneFormValue(dataRef.current)
      setCurrentDefaults(defaultsRef.current)
      status.succeed()
    } catch (error) {
      if (!isAbortError(error)) throw error
    } finally {
      status.end()
    }
  }

  return {
    data,
    setData(field: string, value: unknown) {
      replaceData({ ...dataRef.current, [field]: value })
      if (field in errorsRef.current) clearErrors(field)
    },
    errors,
    error: status.error,
    pending: status.pending,
    hasChanges,
    wasSuccessful: status.wasSuccessful,
    recentlySuccessful: status.recentlySuccessful,
    reset(...args: ReadonlyArray<string | FormResetOptions>) {
      const { initial: toInitial, fields } = parseFormResetArgs(args)
      const source = toInitial ? initial.current : defaultsRef.current
      if (fields.length === 0) return replaceData(cloneFormValue(source))
      const next = { ...dataRef.current }
      for (const field of fields) next[field] = cloneFormValue(source[field])
      replaceData(next)
    },
    setError: (field: string, message: string) => replaceErrors({ ...errorsRef.current, [field]: message }),
    clearErrors,
    clearError: () => status.setError(null),
    post: (submitOptions?: FormSubmitOptions) => submit('POST', submitOptions),
    put: (submitOptions?: FormSubmitOptions) => submit('PUT', submitOptions),
    patch: (submitOptions?: FormSubmitOptions) => submit('PATCH', submitOptions),
    delete: (submitOptions?: FormSubmitOptions) => submit('DELETE', submitOptions),
  } as FormReturn<Fields>
}

export type IslandFormReturn<T extends Fields> = IslandFormState<T, 'setters'> &
  Readonly<{ setData: <K extends keyof T & string>(field: K, value: T[K]) => void }>

/**
 * Form hook for island pages. Uses fetch and a page reload instead of the
 * Void Router, which island pages do not have.
 */
export function useIslandForm<T extends Fields>(defaults: T): IslandFormReturn<T> {
  const [data, setDataState] = useState<Fields>(() => ({ ...defaults }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const status = useSubmissionStatus()
  const dataRef = useRef(data)
  const defaultsRef = useRef<Fields>({ ...defaults })

  const replaceData = (next: Fields) => {
    dataRef.current = next
    setDataState(next)
  }

  async function submit(url: string, method: string) {
    status.begin()
    setErrors({})
    try {
      const result = await submitIslandAction(url, method, dataRef.current)
      if (result.kind === 'redirect') {
        window.location.href = result.url
      } else if (result.kind === 'success') {
        defaultsRef.current = { ...dataRef.current }
        status.succeed()
        window.location.reload()
      } else if (result.kind === 'validation') {
        setErrors(result.errors)
      } else {
        status.setError(result.error)
      }
    } finally {
      status.end()
    }
  }

  return {
    data,
    setData: (field: string, value: unknown) => replaceData({ ...dataRef.current, [field]: value }),
    errors,
    error: status.error,
    pending: status.pending,
    hasChanges: Object.keys(defaultsRef.current).some(
      (key) => !isEqualFormValue(data[key], defaultsRef.current[key]),
    ),
    wasSuccessful: status.wasSuccessful,
    recentlySuccessful: status.recentlySuccessful,
    reset(...fields: ReadonlyArray<string>) {
      if (fields.length === 0) return replaceData({ ...defaultsRef.current })
      const next = { ...dataRef.current }
      for (const field of fields) next[field] = defaultsRef.current[field]
      replaceData(next)
    },
    clearErrors(...fields: ReadonlyArray<string>) {
      if (fields.length === 0) return setErrors({})
      setErrors((previous) => {
        const next = { ...previous }
        for (const field of fields) delete next[field]
        return next
      })
    },
    clearError: () => status.setError(null),
    post: (url: string) => submit(url, 'POST'),
    put: (url: string) => submit(url, 'PUT'),
    patch: (url: string) => submit(url, 'PATCH'),
    delete: (url: string) => submit(url, 'DELETE'),
  } as IslandFormReturn<T>
}

export type FormProps = PropsWithChildren<
  Omit<JSX.IntrinsicElements['form'], 'action' | 'onSubmit' | 'method'> & {
    form: FormModel
    method?: FormMethod
    renderError?: (error: VoidActionError) => Child
  }
>

/** Submits through a `useForm` model and shows its action error. */
export function Form({ form, method = 'post', renderError, children, ...rest }: FormProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => scheduleFormRetry(form.error, () => setNow(Date.now())), [form.error])
  const message = formErrorMessage(form)
  const retry = formRetryMessage(form.error)
  return (
    <form
      {...rest}
      aria-busy={form.pending}
      onSubmit={async (event: Event) => {
        event.preventDefault()
        if (!formSubmissionBlocked(form, now)) await form[method]()
      }}
    >
      {message && (
        <div role="alert" data-void-form-error>
          {form.error && renderError ? renderError(form.error) : message}
          {retry && <p>{retry}</p>}
        </div>
      )}
      {children}
    </form>
  )
}
