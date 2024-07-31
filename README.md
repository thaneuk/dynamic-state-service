# dynamic-state-service

## A simple "extends" from Angular Class for state values, or **provide** in components for state values.
### _This is a reference piece of code and a work in progress._

Designed for state services to extend to allow easy creation of State services, no heavy lifting library needed: easy use and further updateable. When extending a type can be used to fix, or you can pass a type in with the methods for more dynamic storage.

Values are stored in a private **Map**; it uses a single private **Subject** for emitting updates based on the value name.

Easily allows users to create **BehaviorSubject**, **ReplaySubject** like state properties in services.
