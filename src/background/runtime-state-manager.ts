import { getLocalValues, setLocalValues } from "../utils/storage"

type RuntimeStateManagerOptions<TState extends Record<string, unknown>> = {
  defaults: TState
  key: string
  normalize?: (value: unknown) => TState
  warn?: (message: string, error: unknown) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (
    isRecord(error) &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return String(error)
}

function isStorageUnavailableError(error: unknown): boolean {
  return /cannot read (?:properties|property) of undefined|storage-unavailable|extension context invalidated|context invalidated/i.test(
    getErrorMessage(error)
  )
}

export class RuntimeStateManager<TState extends Record<string, unknown>> {
  private cache: TState | null = null
  private loadPromise: Promise<TState> | null = null
  private savePromise: Promise<void> = Promise.resolve()

  constructor(private readonly options: RuntimeStateManagerOptions<TState>) {}

  private normalize(value: unknown): TState {
    return this.options.normalize
      ? this.options.normalize(value)
      : {
          ...this.options.defaults,
          ...(isRecord(value) ? value : {})
        }
  }

  private warn(message: string, error: unknown): void {
    if (isStorageUnavailableError(error)) return

    this.options.warn?.(message, error)
  }

  async load(): Promise<TState> {
    if (this.cache) return this.cache
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = getLocalValues({
      [this.options.key]: this.options.defaults
    })
      .then((items) => {
        const state = this.normalize(items[this.options.key])
        this.cache = state
        return state
      })
      .catch((error) => {
        this.warn("Failed to load FontARA runtime state.", error)
        this.cache = this.options.defaults
        return this.options.defaults
      })
      .finally(() => {
        this.loadPromise = null
      })

    return this.loadPromise
  }

  save(state: TState): Promise<void> {
    const normalizedState = this.normalize(state)
    this.cache = normalizedState

    this.savePromise = this.savePromise
      .catch(() => {})
      .then(() =>
        setLocalValues({
          [this.options.key]: normalizedState
        })
      )
      .catch((error) => {
        this.warn("Failed to save FontARA runtime state.", error)
      })

    return this.savePromise
  }
}
