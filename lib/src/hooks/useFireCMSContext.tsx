import { useContext } from "react";
import { FireCMSContextInstance } from "../core/contexts/FireCMSContext";
import { AuthController, FireCMSContext, User } from "../types";

/**
 * Hook to retrieve the {@link FireCMSContext}.
 *
 * Consider that in order to use this hook you need to have a parent
 * `FireCMS` component.
 *
 * @see FireCMSContext
 * @category Hooks and utilities
 */
export const useFireCMSContext = <UserType extends User = User, AuthControllerType extends AuthController<UserType> = AuthController<UserType>>(): FireCMSContext<UserType, AuthControllerType> => useContext(FireCMSContextInstance) as FireCMSContext<UserType, AuthControllerType>;
