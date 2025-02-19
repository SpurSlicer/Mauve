// -----------------------IMPORTS-----------------------
// None

/**
 * Base interface that classes with listeners, complex constructors, or constructors that must run async code should code to.
 * @interface
 */
class M_Base {
	/**
	 * Sets up the command class. \
	 * **Note:** Needs to be overidden.
     */
	async setup() { };

	/**
	 * Deconstructs the command class. \
	 * **Note:** Needs to be overidden.
     */
	async takedown() { };
}

// -----------------------EXPORTS-----------------------
module.exports = { M_Base };