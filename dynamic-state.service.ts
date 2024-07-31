import { distinctUntilChanged, filter, map, Observable, of, shareReplay, startWith, Subject } from 'rxjs';
import { DestroyRef, inject, Injectable } from '@angular/core';

interface IStateOpts<T> {
  buffer?: number;
  initialValue?: T;
}

interface IStateOptsWithDistinct<T> extends IStateOpts<T> {
  distinctFn?: (previous: T, current: T) => boolean;
}

/**
 * Class to extend from to allow creation of dynamic storage, with
 * methods to return observables on when those values change.
 *
 * Uses a single Observable to emit, stores values in a Map to efficiently use memory.
 *
 * Use: private readonly val$: Observable<boolean> = this.stateValue$<boolean>('valName', { initialValue: false });
 * Use: private readonly val$: Observable<number> = this.stateValue$<boolean>('valName', { initialValue: 2 });
 * Use: private readonly val$: Observable<string> = this.stateValue$<boolean>('valName');
 *
 * service uses inject(DestroyRef), can be provided in a component and will clean itself up
 */
@Injectable()
export abstract class DynamicStateService<DT = unknown> {
  readonly #stateValue: Map<string, DT> = new Map();
  readonly #stateValueUpdated$: Subject<string> = new Subject();

  protected constructor() {
    inject(DestroyRef).onDestroy((): void => {
      this.#stateValueUpdated$.complete();
      this.#stateValue.clear();
    });
  }

  /**
   * get or set general state value, cannot store undefined
   * use null to denote no value as this is the appropriate value for this state
   * 1. Cannot store undefined, use null
   */
  protected stateValue<T extends DT>(name: string, value?: T): undefined | T {
    if (value === undefined) {
      return this.#stateValue.get(name) as undefined | T;
    }
    this.#stateValue.set(name, value);
    this.#stateValueUpdated$.next(name);
    return;
  }

  /**
   * A single emit of a state value, value could be undefined if it
   * has not been set yet, if needed a single value before it is set use
   * stateValue$ with a take(1)
   */
  protected stateValueOnce$<T extends DT>(name: string): Observable<undefined | T> {
    return of(this.stateValue<T>(name));
  }

  /**
   * Subscribe to a state value, and its updates, whether it exists yet or not.
   * Will only emit when the value has been set for the first time.
   * Use setInitValue to set an initial value, if a value already exists
   * in state, then this value will be ignored.
   * Returned observable will always return with shareReplay of buffer size minimum 1
   * as this is for state, to prevent set buffer to 0 to mimic a subject.
   * 1. Remember to unsubscribe, the shareReplay has refCount true for this.
   * 2. Cannot have initial value of undefined, use null.
   * 3. No initial value for "Replay Subject" behavior
   * 4. Initial value for "Behavior Subject" behavior
   */
  protected stateValue$<T extends DT>(name: string, opts?: IStateOpts<T>): Observable<T> {
    opts = { ...{ buffer: 1 }, ...opts };

    if (opts?.initialValue !== undefined && !this.#stateValue.has(name)) {
      this.stateValue(name, opts.initialValue);
    }

    return this.#stateValueUpdated$.pipe(
      filter(stateUpdated => stateUpdated === name),
      startWith(name),
      filter(() => this.hasStateValue(name)),
      map(() => this.stateValue<T>(name) as T),
      // @ts-ignore because you can submit undefined, but typescript doesn't care
      opts?.buffer ? shareReplay({ bufferSize: opts.buffer, refCount: true }) : undefined
    );
  }

  /**
   * same as stateValue, but has distinctUntilChanged added:
   * * leave for (a: T, b: T) => Object.is(a, b) or use { distinctFn: (previous: T, current: T) => boolean }
   * * default distinct uses Object.is because https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness#same-value_equality_using_object.is
   */
  protected stateValueDistinct$<T extends DT>(name: string, opts?: IStateOptsWithDistinct<T>): Observable<T> {
    return this.stateValue$(name, opts).pipe(distinctUntilChanged(opts?.distinctFn ?? this.defaultDistinctFn<T>()));
  }

  private defaultDistinctFn<T>() {
    return (a: T, b: T) => Object.is(a, b);
  }

  protected hasStateValue(name: string): boolean {
    return this.#stateValue.has(name);
  }

  /**
   * remove state value that is no longer needed, or to prevent emits while maintaining observers
   */
  protected removeStateValue(name: string): void {
    this.#stateValue.delete(name);
  }

  protected clearStateValues(): void {
    this.#stateValue.clear();
  }
}
